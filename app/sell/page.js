'use client';

import { useState, useEffect } from 'react';
import { supabase } from '/lib/supabaseClient';

export default function SellPage() {
  // รายการสินค้าทั้งหมด สำหรับ dropdown
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // ตะกร้าสินค้าที่จะขาย: แต่ละแถวเก็บ productId, quantity และ snapshot ข้อมูลสินค้า
  const [cart, setCart] = useState([]);

  // ค่าที่กำลังเลือกเพื่อ "เพิ่มลงตะกร้า" (ยังไม่ใช่รายการในตะกร้า)
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState('');

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
      setErrorMsg('โหลดข้อมูลสินค้าไม่สำเร็จ: ' + error.message);
    } else {
      setProducts(data);
    }
    setLoading(false);
  }

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const qtyNumber = parseInt(quantity, 10) || 0;

  // จำนวนที่ถูกใส่ในตะกร้าไปแล้วของสินค้าตัวนี้ (กันเผลอเพิ่มเกิน stock ตอนกดซ้ำ)
  const alreadyInCart = cart
    .filter((item) => item.productId === selectedProductId)
    .reduce((sum, item) => sum + item.quantity, 0);

  // เพิ่มสินค้าลงตะกร้า
  function handleAddToCart(e) {
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
    if (alreadyInCart + qtyNumber > selectedProduct.stock) {
      setErrorMsg(
        `สินค้าคงเหลือไม่เพียงพอ (คงเหลือ ${selectedProduct.stock} ${selectedProduct.unit || ''}, อยู่ในตะกร้าแล้ว ${alreadyInCart})`
      );
      return;
    }

    // ถ้าสินค้านี้อยู่ในตะกร้าแล้ว ให้รวมจำนวนกันแทนที่จะสร้างแถวใหม่
    const existingIndex = cart.findIndex(
      (item) => item.productId === selectedProduct.id
    );

    if (existingIndex >= 0) {
      const updatedCart = [...cart];
      updatedCart[existingIndex] = {
        ...updatedCart[existingIndex],
        quantity: updatedCart[existingIndex].quantity + qtyNumber,
      };
      setCart(updatedCart);
    } else {
      setCart([
        ...cart,
        {
          productId: selectedProduct.id,
          name: selectedProduct.name,
          price: selectedProduct.price,
          unit: selectedProduct.unit,
          stock: selectedProduct.stock,
          quantity: qtyNumber,
        },
      ]);
    }

    // เคลียร์ช่องกรอกเพื่อเพิ่มรายการถัดไป
    setSelectedProductId('');
    setQuantity('');
  }

  // ลบสินค้าออกจากตะกร้า
  function removeFromCart(productId) {
    setCart(cart.filter((item) => item.productId !== productId));
  }

  // แก้ไขจำนวนสินค้าในตะกร้าโดยตรง
  function updateCartQuantity(productId, newQty) {
    setCart(
      cart.map((item) =>
        item.productId === productId
          ? { ...item, quantity: newQty }
          : item
      )
    );
  }

  // ยอดรวมทั้งบิล = ผลรวมของ (ราคา x จำนวน) ทุกแถวในตะกร้า
  const grandTotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  function resetAll() {
    setCart([]);
    setSelectedProductId('');
    setQuantity('');
  }

  // ยืนยันการขายทั้งบิล: บันทึกทุกแถวลง sales และลด stock ทุกสินค้าที่เกี่ยวข้อง
  async function handleCheckout() {
    setErrorMsg('');
    setSuccessMsg('');

    if (cart.length === 0) {
      setErrorMsg('ยังไม่มีสินค้าในตะกร้า');
      return;
    }

    // ตรวจสอบ stock ล่าสุดอีกครั้งก่อนยืนยัน (กันกรณี stock เปลี่ยนระหว่างเลือกสินค้า)
    for (const item of cart) {
      const currentProduct = products.find((p) => p.id === item.productId);
      if (!currentProduct || item.quantity > currentProduct.stock) {
        setErrorMsg(
          `"${item.name}" มีสินค้าไม่เพียงพอ กรุณาตรวจสอบตะกร้าอีกครั้ง`
        );
        return;
      }
    }

    setSubmitting(true);

    const soldAt = new Date().toISOString();

    // 1) บันทึกทุกแถวในตะกร้าลงตาราง sales พร้อมกัน
    const salesRows = cart.map((item) => ({
      product_id: item.productId,
      product_name: item.name,
      quantity: item.quantity,
      total_price: item.price * item.quantity,
      sold_at: soldAt,
    }));

    const { error: saleError } = await supabase.from('sales').insert(salesRows);

    if (saleError) {
      setErrorMsg('บันทึกการขายไม่สำเร็จ: ' + saleError.message);
      setSubmitting(false);
      return;
    }

    // 2) อัปเดต stock ของสินค้าแต่ละตัวในตะกร้า
    for (const item of cart) {
      const currentProduct = products.find((p) => p.id === item.productId);
      const newStock = currentProduct.stock - item.quantity;

      const { error: updateError } = await supabase
        .from('products')
        .update({ stock: newStock })
        .eq('id', item.productId);

      if (updateError) {
        setErrorMsg(
          `บันทึกการขายสำเร็จ แต่ปรับปรุงสต็อกของ "${item.name}" ไม่สำเร็จ: ` +
            updateError.message
        );
        setSubmitting(false);
        fetchProducts();
        return;
      }
    }

    // สำเร็จทั้งบิล
    setSuccessMsg(`ขายสำเร็จ ยอดรวม ${grandTotal.toFixed(2)} บาท`);
    resetAll();
    fetchProducts();
    setSubmitting(false);
  }

  return (
    <div>
      {/* สรุปยอดรวมไว้บนสุด ตัวใหญ่ ให้เห็นชัดทั้งฝั่งผู้ขายและลูกค้า */}
      <div className="card total-summary">
        <div className="total-label">ยอดรวมทั้งหมด</div>
        <div className="total-amount">{grandTotal.toFixed(2)} บาท</div>
        <div className="total-sub">{cart.length} รายการในตะกร้า</div>
      </div>

      {errorMsg && (
        <p style={{ color: 'red', fontWeight: 'bold' }}>{errorMsg}</p>
      )}
      {successMsg && (
        <p style={{ color: 'green', fontWeight: 'bold' }}>{successMsg}</p>
      )}

      {/* ฟอร์มเพิ่มสินค้าลงตะกร้า */}
      <div className="card">
        <h2>เพิ่มสินค้า</h2>
        {loading ? (
          <p>กำลังโหลดข้อมูลสินค้า...</p>
        ) : (
          <form onSubmit={handleAddToCart}>
            <div className="form-row">
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

              <input
                type="number"
                min="1"
                placeholder="จำนวน"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />

              <button type="submit">+ เพิ่มลงตะกร้า</button>
            </div>
          </form>
        )}
      </div>

      {/* ตารางตะกร้าสินค้า */}
      <div className="card">
        <h2>รายการที่จะขาย</h2>
        {cart.length === 0 ? (
          <p>ยังไม่มีสินค้าในตะกร้า</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ชื่อสินค้า</th>
                <th>ราคา/หน่วย</th>
                <th>จำนวน</th>
                <th>รวม</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cart.map((item) => (
                <tr key={item.productId}>
                  <td>{item.name}</td>
                  <td>{item.price} บาท</td>
                  <td style={{ maxWidth: '90px' }}>
                    <input
                      type="number"
                      min="1"
                      max={item.stock}
                      value={item.quantity}
                      onChange={(e) =>
                        updateCartQuantity(
                          item.productId,
                          parseInt(e.target.value, 10) || 1
                        )
                      }
                    />
                  </td>
                  <td>
                    <strong>{(item.price * item.quantity).toFixed(2)} บาท</strong>
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.productId)}
                      style={{ backgroundColor: '#e00' }}
                    >
                      ลบ
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {cart.length > 0 && (
          <button
            type="button"
            onClick={handleCheckout}
            disabled={submitting}
            className="checkout-btn"
          >
            {submitting ? 'กำลังบันทึก...' : `ยืนยันการขาย (${grandTotal.toFixed(2)} บาท)`}
          </button>
        )}
      </div>
    </div>
  );
}
