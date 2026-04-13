import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'

const XIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
)
const TrashIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
)

export default function CartDrawer() {
    const navigate = useNavigate()
    const { cart, cartTotal, isOpen, closeCart, removeFromCart } = useCart()

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={closeCart} />

            {/* Drawer */}
            <div className="w-full max-w-md bg-white flex flex-col shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-rl-gray-3">
                    <h2 className="font-extrabold text-rl-dark text-lg">
                        Your Cart ({cart.length})
                    </h2>
                    <button
                        onClick={closeCart}
                        className="w-8 h-8 rounded-full bg-rl-gray-4 flex items-center justify-center hover:bg-rl-gray-3 transition-colors"
                    >
                        <XIcon />
                    </button>
                </div>

                {/* Content */}
                {cart.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                        <div className="text-5xl mb-4">🛒</div>
                        <h3 className="font-bold text-rl-dark mb-2">Your cart is empty</h3>
                        <p className="text-sm text-rl-gray mb-6">Browse listings and add items to rent.</p>
                        <button onClick={() => { closeCart(); navigate('/browse') }} className="btn-primary text-sm">
                            Browse Items
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Items */}
                        <div className="flex-1 overflow-y-auto divide-y divide-rl-gray-3">
                            {cart.map((item) => (
                                <div key={item.cartId} className="p-4 flex gap-3">
                                    <img
                                        src={item.image}
                                        alt={item.title}
                                        className="w-20 h-16 object-cover rounded-xl shrink-0"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-rl-dark text-sm leading-tight truncate">
                                            {item.title}
                                        </p>
                                        <p className="text-xs text-rl-gray mt-0.5">
                                            {item.days} day{item.days !== 1 ? 's' : ''} · {item.qty} unit{item.qty !== 1 ? 's' : ''}
                                        </p>
                                        <p className="text-xs text-rl-gray-2 mt-0.5">
                                            {item.startDate} → {item.endDate}
                                        </p>
                                        <div className="flex items-center justify-between mt-2">
                                            <span className="text-sm font-bold text-rl-dark">${item.total}</span>
                                            <button
                                                onClick={() => removeFromCart(item.cartId)}
                                                className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1"
                                            >
                                                <TrashIcon /> Remove
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Footer */}
                        <div className="p-5 border-t border-rl-gray-3 space-y-3">
                            <div className="flex justify-between font-extrabold text-rl-dark text-lg">
                                <span>Total</span>
                                <span>${cartTotal}</span>
                            </div>
                            <button
                                onClick={() => { closeCart(); navigate('/checkout') }}
                                className="w-full bg-rl-blue hover:bg-rl-blue-500 text-white font-bold py-3.5 rounded-xl text-sm transition-colors"
                            >
                                Proceed to Checkout →
                            </button>
                            <button
                                onClick={() => { closeCart(); navigate('/browse') }}
                                className="w-full border border-rl-gray-3 text-rl-dark font-medium py-2.5 rounded-xl text-sm hover:bg-rl-gray-4 transition-colors"
                            >
                                Continue Shopping
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
