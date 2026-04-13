import React, { createContext, useContext, useState } from 'react';

const CartContext = createContext();

export function CartProvider({ children }) {
  const [cartCount, setCartCount] = useState(0);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const openCart = () => setIsCartOpen(true);
  const closeCart = () => setIsCartOpen(false);

  const value = {
    cartCount,
    setCartCount,
    isCartOpen,
    openCart,
    closeCart
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    // Graceful fallback if used outside provider
    return { cartCount: 0, openCart: () => {}, closeCart: () => {}, isCartOpen: false };
  }
  return context;
}
