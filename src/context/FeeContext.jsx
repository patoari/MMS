import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { useSiteSettings } from './SiteSettingsContext';
import { getCurrentDate } from '../utils/dateFormat';
import { generateReceiptNo } from '../utils';

const FeeContext = createContext(null);

export function FeeProvider({ children }) {
  const [fees, setFees]               = useState([]);
  const [feeSettings, setFeeSettings] = useState([]);
  const [receipts, setReceipts]       = useState([]);
  const { settings: siteSettings }    = useSiteSettings();

  const fetchFees = async () => {
    try {
      const res = await api.get('/fees');
      setFees(Array.isArray(res.data) ? res.data : []);
    } catch (e) { /* Failed to load fees */ }
  };

  const fetchSettings = async () => {
    try {
      const res = await api.get('/fee-settings');
      setFeeSettings(res.data || []);
    } catch (e) { /* Failed to load fee settings */ }
  };

  useEffect(() => { fetchFees(); fetchSettings(); }, []);

  const saveReceipts = (list) => {
    setReceipts(list);
  };

  /**
   * Collect multiple fee payments at once and return one combined receipt.
   * payments: [{ feeId, amount }]
   * studentInfo: { studentId, studentName, studentClass, guardian, phone }
   * paymentDate: actual date of payment (defaults to today)
   */
  const collectMultiple = async (payments, studentInfo = {}, paymentDate = null) => {
    // Capture fee data BEFORE API calls — fees state is stale after fetchFees() due to async closure
    const feeSnapshot = payments.map(({ feeId, amount }) => {
      const fee = fees.find(f => f.id === feeId) || {};
      return {
        feeId,
        category:  fee.category || '—',
        month:     fee.month    || '—',
        feeAmount: Number(fee.amount || 0),
        prevPaid:  Number(fee.paid   || 0),
        thisPaid:  Number(amount),
      };
    });

    // fire all collect calls with payment date
    await Promise.all(
      payments.map(({ feeId, amount }) =>
        api.post(`/fees/${feeId}/collect`, { 
          amount,
          payment_date: paymentDate || new Date().toISOString().split('T')[0]
        })
      )
    );
    await fetchFees();

    const lineItems = feeSnapshot;

    const totalThisPaid = lineItems.reduce((s, i) => s + i.thisPaid, 0);

    const receipt = {
      receiptNo:    generateReceiptNo(siteSettings?.receiptIdPrefix || 'RCP'),
      studentId:    studentInfo.studentId    || '—',
      studentName:  studentInfo.studentName  || '—',
      studentClass: studentInfo.studentClass || '—',
      guardian:     studentInfo.guardian     || '—',
      phone:        studentInfo.phone        || '—',
      lineItems,
      totalThisPaid,
      date:      getCurrentDate(),
      createdAt: new Date().toISOString(),
    };

    saveReceipts([receipt, ...receipts]);

    // Persist receipt to DB
    try {
      await api.post('/receipts', {
        receipt_no:    receipt.receiptNo,
        fee_id:        payments[0]?.feeId || null,
        student_id:    receipt.studentId !== '—' ? receipt.studentId : null,
        student_name:  receipt.studentName,
        student_class: receipt.studentClass,
        guardian:      receipt.guardian,
        phone:         receipt.phone,
        line_items:    JSON.stringify(receipt.lineItems),
        total_this_paid: receipt.totalThisPaid,
        paid_amount:   receipt.totalThisPaid,
        total_amount:  receipt.lineItems.reduce((s, i) => s + i.feeAmount, 0),
        total_paid:    receipt.totalThisPaid,
        category:      receipt.lineItems.map(i => i.category).join(', '),
        month:         receipt.lineItems.map(i => i.month).join(', '),
      });
    } catch {} // non-blocking — receipt still works in-memory
    return receipt;
  };

  // Keep single-fee collect for backward compat (wraps collectMultiple)
  const collectFee = async (feeId, amount, studentInfo = {}, paymentDate = null) =>
    collectMultiple([{ feeId, amount }], studentInfo, paymentDate);

  const addFeeRecord = async (record) => {
    await api.post('/fees', record);
    await fetchFees();
  };

  const updateFeeSetting = async (classId, key, value) => {
    // Optimistically update local state
    setFeeSettings(prev =>
      prev.map(s => s.class_id === classId ? { ...s, [key]: value } : s)
    );
  };

  const saveFeeSetting = async (classId) => {
    // Read the latest value directly from state via functional update trick
    let target;
    setFeeSettings(prev => {
      target = prev.find(s => s.class_id === classId);
      return prev;
    });
    if (!target) return;
    await api.put(`/fee-settings/${classId}`, {
      admission: Number(target.admission),
      session:   Number(target.session),
      monthly:   Number(target.monthly),
      exam:      Number(target.exam),
    });
  };

  const saveAllFeeSettings = async () => {
    // Read current state snapshot
    const snapshot = await new Promise(resolve => {
      setFeeSettings(prev => { resolve(prev); return prev; });
    });
    await Promise.all(
      snapshot.map(s =>
        api.put(`/fee-settings/${s.class_id}`, {
          admission: Number(s.admission),
          session:   Number(s.session),
          monthly:   Number(s.monthly),
          exam:      Number(s.exam),
        })
      )
    );
  };

  const getAmountForClass = (className, categoryKey) => {
    const s = feeSettings.find(s => s.class === className);
    return s ? s[categoryKey] : 0;
  };

  const safeFees       = Array.isArray(fees) ? fees : [];
  const totalCollected = safeFees.reduce((s, f) => s + Number(f.paid), 0);
  const totalDue       = safeFees.reduce((s, f) => s + (Number(f.due) > 0 ? Number(f.due) : 0), 0);

  return (
    <FeeContext.Provider value={{
      fees, collectFee, collectMultiple, addFeeRecord,
      feeSettings, updateFeeSetting, saveAllFeeSettings, getAmountForClass,
      totalCollected, totalDue, receipts,
    }}>
      {children}
    </FeeContext.Provider>
  );
}

export const useFees = () => useContext(FeeContext);
