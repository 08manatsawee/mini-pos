'use client';

import { useState, useEffect } from 'react';
import { supabase } from '/lib/supabaseClient';

export default function SellPage() {
  // รายการสินค้าทงหมด สหรับ dropdown
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // คาทีเลือกในฟอร์มขาย
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState('');

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // โหลดรายการสินค้าตอนเปดหน้า
  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      setErrorMsg('โหลดขอมลสินค้าไม่สำเร็จ: ' + error.message);
    } else {
      setProducts(data);
    }
    setLoading(false);
  }

  // หาสนค้าที่เลอกอยู่ในปจจบัน (ใช้คนวณยอดรวมและตรวจ stock)
  const selectedProduct = products.find((p) => p.id === selectedProductId);

  // คำนวณยอดรวม = ราคา x จำนวน
  const qtyNumber = parseInt(quantity, 10) || 0;
  const totalPrice = selectedProduct ? selectedProduct.price * qtyNumber : 0;

  function resetForm() {
    setSelectedProductId('');
    setQuantity('');
  }

  async function handleSell(e) {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!selectedProduct) {
      setErrorMsg('กรุณาเลือกสินค้า');
      return;
    }
    if (qtyNumber <= 0) {
      setErrorMsg('กรุณากรอกจำนวนให้ถูกต้อง');
      return;
    }

    // ตรวจสอบ stock คงเหลือให้เพียงพอก่อนขาย
    if (qtyNumber > selectedProduct.stock) {
      setErrorMsg(
        `สินค้าคงเหลือไม่เพียงพอ (คงเหลือ ${selectedProduct.stock} ${selectedProduct.unit || ''})`
      );
      return;
    }

    setSubmitting(true);

    // 1) บันทึกรายการขายลงตาราง sales
    const { error: saleError } = await supabase.from('sales').insert([
      {
        product_id: selectedProduct.id,
        product_name: selectedProduct.name,
        quantity: qtyNumber,
        total_price: totalPrice,
        sold_at: new Date().toISOString(),
      },
    ]);

    if (saleError) {
      setErrorMsg('บันทกการขายไม่สำเร็จ: ' + saleError.message);
      setSubmitting(false);
      return;
    }

    // 2) อัปเดต stock สนค้าใหลดลงตามจำนวนที่ขาย
    const newStock = selectedProduct.stock - qtyNumber;
    const { error: updateError } = await supabase
      .from('products')
      .update({ stock: newStock })
      .eq('id', selectedProduct.id);

    if (updateError) {
      setErrorMsg(
        'บันทึกการขายสเร็จ แต่ปรับปรงสตอกไม่สเร็จ: ' + updateError.message
      );
      setSubmitting(false);
      return;
    }

    // สเร็จ: แจ้งเตือน รเซ็ตฟอร์ม และโหลดขอมูลสินคาใหม่ (stock ลาสด)
    setSuccessMsg(
      `ขาย "${selectedProduct.name}" จนวน ${qtyNumber} ${selectedProduct.unit || ''} สำเรจ`
    );
    resetForm();
    fetchProducts();
    setSubmitting(false);
  }

  return (
    <div>
      <h1>ขายสินค้า</h1>

      {errorMsg && (
        <p style={{ color: 'red', fontWeight: 'bold' }}>{errorMsg}</p>
      )}
      {successMsg && (
        <p style={{ color: 'green', fontWeight: 'bold' }}>{successMsg}</p>
      )}

      <div className="card">
        {loading ? (
          <p>กำลังโหลดข้อมูลสินค้า...</p>
        ) : (
          <form onSubmit={handleSell}>
            <div className="form-row">
              {/* Dropdown เลือกสินค้า แสดงชื่อและราคา */}
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                required
              >
                <option value="">-- เลือกสินค้า --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} - {p.price} บาท (คงเหลือ {p.stock})
                  </option>
                ))}
              </select>

              {/* ช่องกรอกจำนวน */}
              <input
                type="number"
                min="1"
                placeholder="จำนวน"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>

            {/* แสดงยอดรวมอัตโนมัติ */}
            <p style={{ fontSize: '1.1rem' }}>
              ยอดรวม:{' '}
              <strong>{totalPrice.toFixed(2)} บาท</strong>
            </p>

            <button type="submit" disabled={submitting}>
              {submitting ? 'กำลังบันทึก...' : 'ขาย'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
