import React from 'react';
import { useCart } from '../context/CartContext';

export default function CartDrawer() {
  const { isCartOpen, closeCart } = useCart();

  if (!isCartOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black bg-opacity-50 transition-opacity" onClick={closeCart} />
      <div className="fixed inset-y-0 right-0 max-w-sm w-full bg-white shadow-xl flex flex-col transform transition-transform">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800">Your Rentals</h2>
          <button onClick={closeCart} className="text-2xl font-bold text-gray-500 hover:text-gray-800">&times;</button>
        </div>
        <div className="p-4 flex-1 overflow-y-auto">
          <p className="text-gray-500">Your cart is currently empty.</p>
        </div>
        <div className="p-4 border-t">
          <button className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold cursor-not-allowed opacity-50">
            Proceed to Checkout
          </button>
        </div>
      </div>
    </div>
  );
}
