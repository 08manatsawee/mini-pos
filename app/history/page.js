'use client';

import { useState, useEffect } from 'react';
import { supabase } from '/lib/supabaseClient';

export default function HistoryPage() {
  // รายการประวัติการขายทั้งหมด
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // โหลดข้อมูลตอนเปิดหน้า
  useEffect(() => {
    fetchSales();
  }, []);

  async function fetchSales() {
    setLoading(true);
    // ดึงขอมูลจากตาราง sales เรียงจากล่าสุดไปเก่าสุด
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .order('sold_at', { ascending: false });

    if (error) {
      setErrorMsg('โหลดประวัติการขายไม่สเรจ: ' + error.message);
    } else {
      setSales(data);
      setErrorMsg('');
    }
    setLoading(false);
  }

  // คำนวณยอดขายรวมทั้งหมดจาก total_price ของทกแถว
  const grandTotal = sales.reduce(
    (sum, sale) => sum + (Number(sale.total_price) || 0),
    0
  );

  // จดรปแบบวนเวลาใหอานงาย
  function formatDateTime(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString('th-TH', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <div>
      <h1>ประวัติการขาย</h1>

      {errorMsg && (
        <p style={{ color: 'red', fontWeight: 'bold' }}>{errorMsg}</p>
      )}

      {/* สรุปยอดขายรวมทั้งหมด */}
      <div className="card">
        <h2 style={{ margin: 0 }}>
          ยอดขายรวมทั้งหมด:{' '}
          <span style={{ color: '#0070f3' }}>
            {grandTotal.toFixed(2)} บาท
          </span>
        </h2>
      </div>

      {/* ตารางแสดงประวัติการขาย */}
      {loading ? (
        <p>กำลังโหลดข้อมูล...</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>วันเวลาที่ขาย</th>
              <th>ชื่อสินค้า</th>
              <th>จำนวน</th>
              <th>ยอดรวม</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((sale) => (
              <tr key={sale.id}>
                <td>{formatDateTime(sale.sold_at)}</td>
                <td>{sale.product_name}</td>
                <td>{sale.quantity}</td>
                <td>{Number(sale.total_price).toFixed(2)} บาท</td>
              </tr>
            ))}
            {sales.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center' }}>
                  ยังไม่มีประวัติการขาย
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
