'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { useAuth } from '@/lib/auth/context';
import { useLanguage } from '@/lib/i18n/context';
import { Modal } from '@/components/ui/Modal';
import { Product, Customer, CashSession, PosCartItem, PosHeldSale, Sale, SaleItem } from '@/lib/types';
import { posAudio } from '@/lib/audio';
import { 
  Search, Barcode, ShoppingCart, Trash2, Plus, Minus, 
  CreditCard, Banknote, Smartphone, User, Pause, Play, 
  Printer, CheckCircle2, Scale, ArrowRight, X, AlertCircle,
  UserCheck, Users, ChevronRight
} from 'lucide-react';

export default function PosPage() {
  const { tenant, user, activeBranchId, branches } = useAuth();
  const { lang, t } = useLanguage();

  // State
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [activeSession, setActiveSession] = useState<CashSession | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [cart, setCart] = useState<PosCartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [heldSales, setHeldSales] = useState<PosHeldSale[]>([]);
  
  // Modals
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [customerModalSearch, setCustomerModalSearch] = useState('');
  const [mobileTab, setMobileTab] = useState<'products' | 'cart'>('products');
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [isWeightOpen, setIsWeightOpen] = useState(false);
  const [isHoldOpen, setIsHoldOpen] = useState(false);
  const [activeWeightedProduct, setActiveWeightedProduct] = useState<Product | null>(null);
  const [inputWeight, setInputWeight] = useState<string>('1.000');
  
  // Checkout & Payment State
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'mobile_wallet' | 'customer_credit' | 'mixed'>('cash');
  const [tenderedAmount, setTenderedAmount] = useState<number>(0);
  const [completedSale, setCompletedSale] = useState<(Sale & { items?: SaleItem[] }) | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saleDiscount, setSaleDiscount] = useState<number>(0);

  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const currentBranch = branches.find(b => b.id === activeBranchId) || branches[0];

  // Store live settings and tenant details
  const [vatEnabled, setVatEnabled] = useState<boolean>(true);
  const [receiptFooter, setReceiptFooter] = useState<string>('شكراً لتعاملكم معنا');
  const [liveTenant, setLiveTenant] = useState<{ id: string; name: string; logo_url?: string } | null>(null);

  // Fetch initial products, customers, active session, and merchant settings
  const loadPosData = useCallback(async () => {
    if (!tenant) return;
    try {
      const branchParam = currentBranch ? `&branchId=${currentBranch.id}` : '';
      const res = await fetch(`/api/merchant/pos?tenantId=${tenant.id}${branchParam}`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
        setCustomers(data.customers || []);
        setActiveSession(data.activeSession || null);
        if (data.settings) {
          setVatEnabled(data.settings.vat_enabled !== 0);
          if (data.settings.receipt_footer) {
            setReceiptFooter(data.settings.receipt_footer);
          }
        }
        if (data.tenant) {
          setLiveTenant(data.tenant);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, [tenant, currentBranch]);

  useEffect(() => {
    loadPosData();
  }, [loadPosData]);

  // Global Keyboard Shortcuts (F2: Search/Barcode focus, F7: Hold sale, F9: Checkout)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        barcodeInputRef.current?.focus();
      } else if (e.key === 'F7') {
        e.preventDefault();
        if (cart.length > 0) handleHoldSale();
      } else if (e.key === 'F9') {
        e.preventDefault();
        if (cart.length > 0) handleOpenCheckout();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart]);

  // Barcode Scanning / Search logic (Handles standard barcodes + Supermarket Weighted scale format e.g. 21XXXXXWWWWWC)
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    // Check for supermarket scale barcode format (e.g. Prefix "21", 5 digits item code, 5 digits weight in grams)
    if (query.startsWith('21') && query.length >= 12) {
      const itemCode = query.slice(2, 7);
      const weightGrams = parseInt(query.slice(7, 12), 10);
      const weightKg = weightGrams / 1000;

      const matchedWeighted = products.find(p => p.barcode.includes(itemCode) || p.sku.includes(itemCode));
      if (matchedWeighted) {
        addToCart(matchedWeighted, weightKg);
        setSearchQuery('');
        return;
      }
    }

    // Standard barcode or SKU lookup
    const matched = products.find(p => 
      p.barcode === query || 
      (p.additional_barcodes && p.additional_barcodes.includes(query)) ||
      p.sku.toLowerCase() === query.toLowerCase() ||
      p.name_en.toLowerCase() === query.toLowerCase() ||
      p.name_ar === query
    );

    if (matched) {
      if (matched.is_weighted) {
        promptWeight(matched);
      } else {
        addToCart(matched, 1);
      }
      setSearchQuery('');
    } else {
      // Keep search filter active
    }
  };

  const promptWeight = (product: Product) => {
    setActiveWeightedProduct(product);
    setInputWeight('1.000');
    setIsWeightOpen(true);
  };

  const handleConfirmWeight = () => {
    if (!activeWeightedProduct) return;
    const weight = parseFloat(inputWeight) || 1.0;

    // Check available stock for weighted item
    if (activeWeightedProduct.track_stock === 1) {
      const stock = activeWeightedProduct.current_stock ?? 0;
      if (stock <= 0) {
        posAudio.playVoid();
        alert(
          lang === 'ar'
            ? `عفواً، الصنف "${activeWeightedProduct.name_ar || activeWeightedProduct.name_en}" غير متوفر في المخزون (الرصيد: 0)!`
            : `Sorry, "${activeWeightedProduct.name_en}" is out of stock (Available: 0)!`
        );
        return;
      }
      if (weight > stock) {
        posAudio.playVoid();
        alert(
          lang === 'ar'
            ? `عفواً، الوزن المطلوب (${weight} كجم) يتجاوز الرصيد المتوفر في المخزون (${stock} كجم)!`
            : `Requested weight (${weight}kg) exceeds available stock (${stock}kg)!`
        );
        return;
      }
    }

    addToCart(activeWeightedProduct, weight);
    setIsWeightOpen(false);
    setActiveWeightedProduct(null);
  };

  const addToCart = (product: Product, qty: number = 1) => {
    // Stock validation
    if (product.track_stock === 1) {
      const stock = product.current_stock ?? 0;
      const existingInCart = cart.find(item => item.product.id === product.id)?.quantity || 0;
      const requestedTotal = existingInCart + qty;

      if (stock <= 0) {
        posAudio.playVoid();
        alert(
          lang === 'ar'
            ? `عفواً، الصنف "${product.name_ar || product.name_en}" غير متوفر في المخزون (الرصيد: 0)!`
            : `Sorry, "${product.name_en}" is out of stock (Available: 0)!`
        );
        return;
      }

      if (requestedTotal > stock) {
        posAudio.playVoid();
        alert(
          lang === 'ar'
            ? `عفواً، لا يمكن إضافة الكمية المطلوبة (${requestedTotal}). الرصيد المتوفر في المخزون هو (${stock}) فقط للصنف "${product.name_ar || product.name_en}".`
            : `Requested quantity (${requestedTotal}) exceeds available stock (${stock}) for "${product.name_en}".`
        );
        return;
      }
    }

    posAudio.playBeep();
    setCart(prev => {
      const existingIndex = prev.findIndex(item => item.product.id === product.id);
      if (existingIndex > -1) {
        const next = [...prev];
        const newQty = next[existingIndex].quantity + qty;
        next[existingIndex] = {
          ...next[existingIndex],
          quantity: newQty,
        };
        return next;
      } else {
        return [
          ...prev,
          {
            product,
            quantity: qty,
            unit_price: product.selling_price,
            cost_price: product.cost_price,
            discount: 0,
            tax_rate: product.tax_rate,
          }
        ];
      }
    });
  };

  const updateQuantity = (index: number, newQty: number) => {
    if (newQty <= 0) {
      removeItem(index);
      return;
    }

    const item = cart[index];
    if (item.product.track_stock === 1) {
      const stock = item.product.current_stock ?? 0;
      if (newQty > stock) {
        posAudio.playVoid();
        alert(
          lang === 'ar'
            ? `عفواً، الكمية المطلوبة (${newQty}) تتجاوز الرصيد المتوفر في المخزون (${stock}) للصنف "${item.product.name_ar || item.product.name_en}".`
            : `Requested quantity (${newQty}) exceeds available stock (${stock}) for "${item.product.name_en}".`
        );
        return;
      }
    }

    posAudio.playBeep();
    setCart(prev => {
      const next = [...prev];
      next[index].quantity = newQty;
      return next;
    });
  };

  const removeItem = (index: number) => {
    posAudio.playVoid();
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const clearCart = () => {
    posAudio.playVoid();
    setCart([]);
    setSelectedCustomer(null);
    setSaleDiscount(0);
  };

  // Calculations
  const subtotal = cart.reduce((acc, item) => acc + (item.unit_price * item.quantity), 0);
  const totalTax = vatEnabled 
    ? cart.reduce((acc, item) => {
        const itemTotal = (item.unit_price * item.quantity) - item.discount;
        return acc + (itemTotal * ((item.tax_rate ?? 14) / 100));
      }, 0)
    : 0;
  const grandTotal = Math.max(0, subtotal - saleDiscount + totalTax);

  const handleOpenCheckout = () => {
    setTenderedAmount(grandTotal);
    setIsCheckoutOpen(true);
  };

  const handleHoldSale = () => {
    if (cart.length === 0) return;
    const held: PosHeldSale = {
      id: `held_${Date.now()}`,
      timestamp: new Date().toLocaleTimeString(),
      customer: selectedCustomer || undefined,
      items: [...cart],
      subtotal,
      total: grandTotal,
    };
    setHeldSales(prev => [held, ...prev]);
    clearCart();
  };

  const handleResumeSale = (held: PosHeldSale) => {
    setCart(held.items);
    setSelectedCustomer(held.customer || null);
    setHeldSales(prev => prev.filter(h => h.id !== held.id));
    setIsHoldOpen(false);
  };

  // Complete Sale (Atomic Checkout Submission)
  const handleFinalizeSale = async () => {
    if (cart.length === 0 || !tenant || !currentBranch) return;
    setIsSubmitting(true);

    try {
      const payload = {
        tenant_id: tenant.id,
        branch_id: currentBranch.id,
        register_id: activeSession ? activeSession.register_id : '',
        session_id: activeSession ? activeSession.id : '',
        cashier_id: user?.id || '',
        customer_id: selectedCustomer?.id || null,
        items: cart.map(item => {
          const itemTax = vatEnabled ? ((item.unit_price * item.quantity - item.discount) * ((item.tax_rate ?? 14) / 100)) : 0;
          const itemLineTotal = (item.unit_price * item.quantity - item.discount) + itemTax;
          return {
            product_id: item.product.id,
            batch_id: item.batch_id || null,
            quantity: item.quantity,
            unit_price: item.unit_price,
            cost_price: item.cost_price,
            discount_amount: item.discount,
            tax_rate: vatEnabled ? (item.tax_rate ?? 14) : 0,
            tax_amount: itemTax,
            line_total: itemLineTotal,
          };
        }),
        subtotal,
        discount_amount: saleDiscount,
        tax_amount: vatEnabled ? totalTax : 0,
        total_amount: grandTotal,
        paid_amount: tenderedAmount,
        change_amount: Math.max(0, tenderedAmount - grandTotal),
        payment_method: paymentMethod,
      };

      const res = await fetch('/api/merchant/pos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Failed to complete sale');
        setIsSubmitting(false);
        return;
      }

      const json = await res.json();
      posAudio.playSuccess();
      setCompletedSale(json.sale);
      setIsCheckoutOpen(false);
      setIsReceiptOpen(true);
      clearCart();
      loadPosData(); // Reload inventory counts
    } catch (e) {
      alert('Error during checkout submission');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesCategory = selectedCategory === 'all' || p.category_id === selectedCategory;
    const matchesSearch = searchQuery === '' || 
      p.name_en.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.name_ar.includes(searchQuery) ||
      p.barcode.includes(searchQuery) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const categories = Array.from(new Set(products.map(p => p.category_id)))
    .map(catId => {
      const prod = products.find(p => p.category_id === catId);
      return { id: catId, name_en: prod?.category_name_en || 'Category', name_ar: prod?.category_name_ar || 'قسم' };
    });

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col lg:flex-row gap-4 overflow-hidden">
      
      {/* Mobile Tab Switcher */}
      <div className="lg:hidden flex items-center bg-gray-100 p-1 rounded-xl shrink-0 gap-1">
        <button
          type="button"
          onClick={() => setMobileTab('products')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${
            mobileTab === 'products' ? 'bg-white text-[#246BFD] shadow-xs' : 'text-[#687386]'
          }`}
        >
          {lang === 'ar' ? 'الكتالوج والأصناف' : 'Products'} ({filteredProducts.length})
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('cart')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
            mobileTab === 'cart' ? 'bg-[#246BFD] text-white shadow-xs' : 'text-[#687386]'
          }`}
        >
          <ShoppingCart className="w-3.5 h-3.5" />
          <span>{lang === 'ar' ? 'السلة' : 'Cart'} ({cart.length}) • {grandTotal.toFixed(1)} EGP</span>
        </button>
      </div>

      {/* Left/Main Column: Product Grid & Search */}
      <div className={`flex-1 flex flex-col bg-white rounded-xl border border-[#E5EAF2] shadow-2xs overflow-hidden ${mobileTab === 'products' ? 'flex' : 'hidden lg:flex'}`}>
        
        {/* Barcode Search & Fast Scanner Input */}
        <div className="p-3.5 border-b border-[#E5EAF2] bg-[#F7F9FC] flex flex-col sm:flex-row gap-2.5">
          <form onSubmit={handleBarcodeSubmit} className="flex-1 relative">
            <input
              ref={barcodeInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={lang === 'ar' ? 'امسح الباركود أو ابحث عن الصنف (F2)...' : 'Scan barcode or search product (F2)...'}
              className="w-full px-3.5 py-2.5 rounded-lg border border-[#CBD5E1] bg-white text-xs text-[#0B1730] font-medium focus:border-[#246BFD] focus:ring-2 focus:ring-[#246BFD]/20 focus:outline-none pl-9 rtl:pl-3 rtl:pr-9 shadow-xs"
              autoFocus
            />
            <Barcode className="w-4 h-4 text-[#246BFD] absolute left-3 rtl:left-auto rtl:right-3 top-3 pointer-events-none" />
          </form>

          {/* Held sales button */}
          {heldSales.length > 0 && (
            <button
              onClick={() => setIsHoldOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#FFFBEB] border border-[#FDE68A] text-xs font-bold text-[#F59E0B] hover:bg-[#FEF3C7] transition-colors cursor-pointer shrink-0"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>{heldSales.length} {lang === 'ar' ? 'معلقات' : 'Held'}</span>
            </button>
          )}
        </div>

        {/* Category Shortcuts Pills */}
        <div className="px-3.5 py-2 border-b border-[#E5EAF2] flex items-center gap-1.5 overflow-x-auto bg-white scrollbar-none">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-all cursor-pointer ${selectedCategory === 'all' ? 'bg-[#0B1730] text-white shadow-xs' : 'bg-[#F7F9FC] text-[#687386] hover:bg-[#EDF2F7]'}`}
          >
            {t('pos_category_all')}
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-all cursor-pointer ${selectedCategory === cat.id ? 'bg-[#0B1730] text-white shadow-xs' : 'bg-[#F7F9FC] text-[#687386] hover:bg-[#EDF2F7]'}`}
            >
              {lang === 'ar' ? cat.name_ar : cat.name_en}
            </button>
          ))}
        </div>

        {/* Product Selection Grid */}
        <div className="flex-1 p-3.5 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 content-start">
          {filteredProducts.map(product => (
            <div
              key={product.id}
              onClick={() => {
                if (product.is_weighted) {
                  promptWeight(product);
                } else {
                  addToCart(product, 1);
                }
              }}
              className="bg-[#F7F9FC] hover:bg-white rounded-xl border border-[#E5EAF2] hover:border-[#246BFD] p-3 flex flex-col justify-between transition-all cursor-pointer shadow-2xs hover:shadow-xs group select-none text-left rtl:text-right"
            >
              <div>
                <div className="flex items-center justify-between text-[10px] text-[#687386] mb-1">
                  <span className="font-mono">{product.sku}</span>
                  {product.is_weighted === 1 && (
                    <span className="px-1.5 py-0.5 rounded bg-[#FEF3C7] text-[#D97706] font-bold flex items-center gap-0.5">
                      <Scale className="w-2.5 h-2.5" />
                      KG
                    </span>
                  )}
                </div>
                <h4 className="text-xs font-bold text-[#0B1730] line-clamp-2 leading-tight group-hover:text-[#246BFD]">
                  {lang === 'ar' ? product.name_ar : product.name_en}
                </h4>
              </div>

              <div className="mt-3 pt-2 border-t border-[#E5EAF2] flex items-center justify-between">
                <span className="text-xs font-extrabold text-[#0B1730]">
                  {product.selling_price} <span className="text-[10px] font-normal text-[#687386]">{t('currency')}</span>
                </span>
                <span className={`text-[10px] font-bold ${product.current_stock && product.current_stock <= product.min_stock_alert ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>
                  {product.current_stock ?? 0} {product.unit_name_en || 'PCS'}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Mobile quick-go to cart bottom dock */}
        {cart.length > 0 && mobileTab === 'products' && (
          <div className="lg:hidden p-3 bg-[#0B1730] text-white flex items-center justify-between border-t border-[#E5EAF2] shrink-0">
            <div>
              <span className="text-xs font-bold">{cart.length} {lang === 'ar' ? 'أصناف في السلة' : 'items'}</span>
              <span className="text-sm font-black mx-2 text-amber-400">{grandTotal.toFixed(2)} EGP</span>
            </div>
            <button
              onClick={() => setMobileTab('cart')}
              className="px-3 py-1.5 bg-[#246BFD] text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs"
            >
              <span>{lang === 'ar' ? 'عرض السلة والدفع' : 'Go to Cart'}</span>
              <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
            </button>
          </div>
        )}

      </div>

      {/* Right Column: Active Cart & Checkout Dock */}
      <div className={`w-full lg:w-96 flex flex-col bg-white rounded-xl border border-[#E5EAF2] shadow-2xs overflow-hidden shrink-0 ${mobileTab === 'cart' ? 'flex' : 'hidden lg:flex'}`}>
        
        {/* Cart Header: Cashier, Customer Selector */}
        <div className="p-3.5 border-b border-[#E5EAF2] bg-[#F7F9FC] space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-[#0B1730]">
              {lang === 'ar' ? 'الكاشير:' : 'Cashier:'} {user?.full_name || 'Ahmed'}
            </span>
            <span className="text-[#687386] font-medium">
              {currentBranch ? (lang === 'ar' ? currentBranch.name_ar : currentBranch.name_en) : 'Branch'}
            </span>
          </div>

          {/* Customer Selector with Popup Trigger */}
          {selectedCustomer ? (
            <div className="flex items-center justify-between p-2 rounded-lg bg-blue-50/70 border border-blue-200">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-full bg-[#246BFD] text-white flex items-center justify-center font-bold text-xs shrink-0">
                  {selectedCustomer.name.charAt(0)}
                </div>
                <div className="min-w-0 text-start">
                  <p className="text-xs font-bold text-[#0B1730] truncate">{selectedCustomer.name}</p>
                  <p className="text-[10px] text-[#687386]">
                    {selectedCustomer.phone} • {selectedCustomer.current_balance > 0 ? (
                      <span className="text-amber-600 font-bold">{lang === 'ar' ? 'مديونية:' : 'Debt:'} {selectedCustomer.current_balance} ج.م</span>
                    ) : (
                      <span className="text-emerald-600 font-bold">{lang === 'ar' ? 'نقاط:' : 'Pts:'} {selectedCustomer.loyalty_points}</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => { setCustomerModalSearch(''); setIsCustomerModalOpen(true); }}
                  className="px-2 py-1 text-[11px] font-bold text-[#246BFD] hover:bg-blue-100 rounded"
                >
                  {lang === 'ar' ? 'تغيير' : 'Change'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCustomer(null)}
                  title={lang === 'ar' ? 'إلغاء وتعيين كعميل عام' : 'Clear to Walk-in'}
                  className="p-1 text-gray-400 hover:text-red-500 rounded"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => { setCustomerModalSearch(''); setIsCustomerModalOpen(true); }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-dashed border-[#246BFD]/50 bg-white hover:bg-blue-50/40 text-xs transition-colors group"
            >
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-[#246BFD]" />
                <span className="font-semibold text-[#0B1730]">{t('pos_walk_in')} ({lang === 'ar' ? 'عميل نقدي عام' : 'General Customer'})</span>
              </div>
              <span className="text-[11px] font-bold text-[#246BFD] group-hover:underline">
                {lang === 'ar' ? 'اختيار عميل' : 'Select Client'} →
              </span>
            </button>
          )}
        </div>

        {/* Cart Items List */}
        <div className="flex-1 p-3 overflow-y-auto divide-y divide-[#E5EAF2]">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#687386]">
              <ShoppingCart className="w-10 h-10 text-gray-300 mb-2 stroke-1" />
              <p className="text-xs font-medium leading-relaxed">
                {t('pos_empty_cart')}
              </p>
            </div>
          ) : (
            cart.map((item, idx) => {
              const lineTotal = (item.unit_price * item.quantity) - item.discount;
              return (
                <div key={idx} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-[#0B1730] truncate">
                      {lang === 'ar' ? item.product.name_ar : item.product.name_en}
                    </p>
                    <p className="text-[11px] text-[#687386]">
                      {item.unit_price} {t('currency')} × {item.quantity}
                    </p>
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center gap-1.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg p-0.5">
                    <button
                      onClick={() => updateQuantity(idx, item.quantity - (item.product.is_weighted ? 0.25 : 1))}
                      className="w-5 h-5 flex items-center justify-center rounded text-[#172033] hover:bg-white cursor-pointer"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-9 text-center text-xs font-bold font-mono">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(idx, item.quantity + (item.product.is_weighted ? 0.25 : 1))}
                      className="w-5 h-5 flex items-center justify-center rounded text-[#172033] hover:bg-white cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Line Total & Remove */}
                  <div className="text-right rtl:text-left shrink-0">
                    <p className="text-xs font-bold text-[#0B1730]">
                      {lineTotal.toFixed(2)}
                    </p>
                    <button
                      onClick={() => removeItem(idx)}
                      className="text-[#EF4444] hover:text-[#DC2626] p-0.5 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Cart Summary & Checkout Action */}
        <div className="p-4 border-t border-[#E5EAF2] bg-[#F7F9FC] space-y-3">
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-[#687386]">
              <span>{t('pos_subtotal')}:</span>
              <span className="font-mono">{subtotal.toFixed(2)} {t('currency')}</span>
            </div>
            {totalTax > 0 && (
              <div className="flex justify-between text-[#687386]">
                <span>{t('pos_tax')} (14% VAT):</span>
                <span className="font-mono">{totalTax.toFixed(2)} {t('currency')}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-extrabold text-[#0B1730] pt-1.5 border-t border-[#E5EAF2]">
              <span>{t('pos_grand_total')}:</span>
              <span className="text-[#246BFD]">{grandTotal.toFixed(2)} {t('currency')}</span>
            </div>
          </div>

          {/* Quick Buttons: Hold, Void, Checkout */}
          <div className="grid grid-cols-4 gap-2 pt-1">
            <button
              onClick={handleHoldSale}
              disabled={cart.length === 0}
              className="py-2.5 rounded-lg border border-[#E5EAF2] bg-white text-xs font-bold text-[#687386] hover:bg-gray-100 disabled:opacity-50 transition-colors cursor-pointer flex flex-col items-center justify-center gap-0.5"
              title="Hold Sale (F7)"
            >
              <Pause className="w-3.5 h-3.5" />
              <span className="text-[10px]">{t('pos_hold_sale')}</span>
            </button>

            <button
              onClick={clearCart}
              disabled={cart.length === 0}
              className="py-2.5 rounded-lg border border-[#FECACA] bg-[#FEF2F2] text-xs font-bold text-[#EF4444] hover:bg-[#FEE2E2] disabled:opacity-50 transition-colors cursor-pointer flex flex-col items-center justify-center gap-0.5"
              title="Void Cart"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="text-[10px]">{lang === 'ar' ? 'مسح' : 'Void'}</span>
            </button>

            <button
              onClick={handleOpenCheckout}
              disabled={cart.length === 0}
              className="col-span-2 py-2.5 rounded-lg bg-[#246BFD] hover:bg-[#1A54D4] text-white text-xs font-bold shadow-xs disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <span>{t('pos_checkout')}</span>
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </button>
          </div>
        </div>

      </div>

      {/* Produce Scale / Weight Modal */}
      <Modal
        isOpen={isWeightOpen}
        onClose={() => setIsWeightOpen(false)}
        title={lang === 'ar' ? 'إدخال وزن الصنف بالميزان' : 'Scale / Weight Input'}
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="text-center">
            <h4 className="text-sm font-bold text-[#0B1730]">
              {lang === 'ar' ? activeWeightedProduct?.name_ar : activeWeightedProduct?.name_en}
            </h4>
            <p className="text-xs text-[#687386] mt-0.5">
              Price: {activeWeightedProduct?.selling_price} {t('currency')}/KG
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#172033] mb-1 text-center">
              {t('pos_weight_kg')}
            </label>
            <input
              type="number"
              step="0.005"
              min="0.01"
              value={inputWeight}
              onChange={(e) => setInputWeight(e.target.value)}
              className="w-full text-center py-3 text-2xl font-mono font-extrabold rounded-lg border border-[#246BFD] text-[#0B1730] focus:outline-none"
              autoFocus
            />
          </div>

          {/* Quick weight buttons */}
          <div className="grid grid-cols-4 gap-1.5">
            {['0.250', '0.500', '1.000', '2.000'].map(w => (
              <button
                key={w}
                type="button"
                onClick={() => setInputWeight(w)}
                className="py-1.5 rounded-md border border-[#E5EAF2] text-xs font-bold hover:bg-[#F7F9FC] cursor-pointer"
              >
                {w} KG
              </button>
            ))}
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              onClick={() => setIsWeightOpen(false)}
              className="px-4 py-2 rounded-lg border border-[#E5EAF2] text-xs font-bold text-[#687386]"
            >
              {t('cancel')}
            </button>
            <button
              onClick={handleConfirmWeight}
              className="px-4 py-2 rounded-lg bg-[#246BFD] text-white text-xs font-bold"
            >
              {lang === 'ar' ? 'إضافة للسلة' : 'Add to Cart'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Checkout & Multi-Payment Modal */}
      <Modal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        title={lang === 'ar' ? 'إتمام الدفع وإصدار الفاتورة' : 'Finalize Sale & Payment'}
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-[#F0F9FF] border border-[#BAE6FD] text-center">
            <span className="text-xs text-[#0284C7] font-semibold uppercase">{t('pos_grand_total')}</span>
            <h3 className="text-3xl font-extrabold text-[#0B1730] mt-1">
              {grandTotal.toFixed(2)} <span className="text-sm font-normal text-[#687386]">{t('currency')}</span>
            </h3>
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="block text-xs font-semibold text-[#172033] mb-2">
              {lang === 'ar' ? 'طريقة الدفع' : 'Payment Method'}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`py-2 px-2.5 rounded-lg border text-xs font-bold flex flex-col items-center gap-1 cursor-pointer transition-all ${paymentMethod === 'cash' ? 'border-[#246BFD] bg-[#F0F9FF] text-[#246BFD]' : 'border-[#E5EAF2] bg-white text-[#172033]'}`}
              >
                <Banknote className="w-4 h-4" />
                <span>{t('pos_cash')}</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('card')}
                className={`py-2 px-2.5 rounded-lg border text-xs font-bold flex flex-col items-center gap-1 cursor-pointer transition-all ${paymentMethod === 'card' ? 'border-[#246BFD] bg-[#F0F9FF] text-[#246BFD]' : 'border-[#E5EAF2] bg-white text-[#172033]'}`}
              >
                <CreditCard className="w-4 h-4" />
                <span>{t('pos_card')}</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('mobile_wallet')}
                className={`py-2 px-2.5 rounded-lg border text-xs font-bold flex flex-col items-center gap-1 cursor-pointer transition-all ${paymentMethod === 'mobile_wallet' ? 'border-[#246BFD] bg-[#F0F9FF] text-[#246BFD]' : 'border-[#E5EAF2] bg-white text-[#172033]'}`}
              >
                <Smartphone className="w-4 h-4" />
                <span>{t('pos_wallet')}</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('customer_credit')}
                className={`py-2 px-2.5 rounded-lg border text-xs font-bold flex flex-col items-center gap-1 cursor-pointer transition-all ${paymentMethod === 'customer_credit' ? 'border-[#246BFD] bg-[#F0F9FF] text-[#246BFD]' : 'border-[#E5EAF2] bg-white text-[#172033]'}`}
              >
                <User className="w-4 h-4" />
                <span>{t('pos_credit')}</span>
              </button>
            </div>
          </div>

          {/* If Cash: Quick Cash Buttons & Tendered Input */}
          {paymentMethod === 'cash' && (
            <div className="space-y-2.5 pt-2">
              <label className="block text-xs font-semibold text-[#172033]">
                {t('pos_amount_tendered')}
              </label>
              <input
                type="number"
                step="0.5"
                value={tenderedAmount}
                onChange={(e) => setTenderedAmount(parseFloat(e.target.value) || 0)}
                className="w-full text-center py-2 text-xl font-bold font-mono rounded-lg border border-[#CBD5E1] text-[#0B1730] focus:border-[#246BFD] focus:outline-none"
              />

              {/* Egyptian Pound Quick Banknotes */}
              <div className="grid grid-cols-4 gap-1.5">
                {[grandTotal, 50, 100, 200].map((val, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setTenderedAmount(Math.ceil(val))}
                    className="py-1.5 rounded-md border border-[#E5EAF2] bg-[#F7F9FC] text-xs font-bold hover:bg-white cursor-pointer"
                  >
                    {idx === 0 ? 'Exact' : `${val} ${t('currency')}`}
                  </button>
                ))}
              </div>

              {tenderedAmount >= grandTotal && (
                <div className="p-3 rounded-lg bg-[#ECFDF5] border border-[#A7F3D0] flex items-center justify-between">
                  <span className="text-xs font-bold text-[#10B981]">{t('pos_change_due')}:</span>
                  <span className="text-lg font-mono font-extrabold text-[#10B981]">
                    {(tenderedAmount - grandTotal).toFixed(2)} {t('currency')}
                  </span>
                </div>
              )}
            </div>
          )}

          {paymentMethod === 'customer_credit' && !selectedCustomer && (
            <div className="p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs font-semibold text-[#EF4444]">
              {lang === 'ar' ? 'يرجى اختيار عميل مسجل لتسجيل المبيعات الآجلة على حسابه.' : 'Please select a registered customer to apply credit sale.'}
            </div>
          )}

          <div className="pt-3 border-t border-[#E5EAF2] flex justify-end gap-2">
            <button
              onClick={() => setIsCheckoutOpen(false)}
              className="px-4 py-2 rounded-lg border border-[#E5EAF2] text-xs font-bold text-[#687386]"
            >
              {t('cancel')}
            </button>
            <button
              onClick={handleFinalizeSale}
              disabled={isSubmitting || (paymentMethod === 'customer_credit' && !selectedCustomer)}
              className="px-5 py-2.5 rounded-lg bg-[#246BFD] hover:bg-[#1A54D4] text-white text-xs font-bold shadow-xs cursor-pointer flex items-center gap-2"
            >
              {isSubmitting ? t('loading') : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{t('pos_complete')}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Held Sales Recall Modal */}
      <Modal
        isOpen={isHoldOpen}
        onClose={() => setIsHoldOpen(false)}
        title={lang === 'ar' ? 'فواتير المبيعات المعلقة' : 'Recall Held Carts'}
        maxWidth="md"
      >
        <div className="space-y-3">
          {heldSales.length === 0 ? (
            <p className="text-xs text-center text-[#687386] py-6">{t('no_records')}</p>
          ) : (
            heldSales.map(h => (
              <div key={h.id} className="p-3.5 rounded-xl border border-[#E5EAF2] bg-[#F7F9FC] flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-[#0B1730]">
                    {h.customer ? h.customer.name : t('pos_walk_in')}
                  </p>
                  <p className="text-[11px] text-[#687386]">
                    {h.items.length} items • {h.timestamp}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#246BFD]">{h.total.toFixed(2)} {t('currency')}</span>
                  <button
                    onClick={() => handleResumeSale(h)}
                    className="px-3 py-1.5 rounded-lg bg-[#246BFD] text-white text-xs font-bold hover:bg-[#1A54D4]"
                  >
                    Resume
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>

      {/* Professional Thermal Receipt Preview Modal (58mm / 80mm format) */}
      <Modal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        title={lang === 'ar' ? 'إيصال البيع الحراري (معاينة وطباعة)' : 'Sales Receipt Preview'}
        maxWidth="sm"
      >
        <div className="space-y-4">
          
          {/* Printable Receipt Area */}
          <div 
            id="printable-receipt"
            className="p-4 bg-white border border-dashed border-gray-300 rounded-lg text-black font-mono text-[11px] space-y-3"
            style={{ width: '80mm', margin: '0 auto' }}
          >
            {/* Header */}
            <div className="text-center space-y-1">
              {/* Merchant's Logo: FIRST thing in invoice (clean, without square box) */}
              <div className="flex items-center justify-center mb-1">
                {(liveTenant?.logo_url || tenant?.logo_url) ? (
                  <img 
                    src={liveTenant?.logo_url || tenant?.logo_url} 
                    alt={liveTenant?.name || tenant?.name || 'Merchant Logo'} 
                    className="max-h-16 max-w-[150px] object-contain" 
                  />
                ) : (
                  <Image 
                    src="/logo.png" 
                    alt="Logo" 
                    width={56} 
                    height={56} 
                    className="object-contain max-h-14" 
                  />
                )}
              </div>
              <h3 className="font-bold text-sm tracking-tight">{liveTenant?.name || tenant?.name || 'Al-Baraka Supermarket'}</h3>
              <p className="text-[10px] text-gray-600">{currentBranch?.address}</p>
              <p className="text-[10px] text-gray-600">Tel: {currentBranch?.phone}</p>
              <div className="border-t border-dashed border-black my-1.5"></div>
            </div>

            {/* Meta */}
            <div className="text-[10px] space-y-0.5">
              <p>Receipt: <strong>{completedSale?.sale_number}</strong></p>
              <p>Date: {completedSale?.created_at || new Date().toLocaleString()}</p>
              <p>Cashier: {user?.full_name}</p>
              {selectedCustomer && <p>Customer: {selectedCustomer.name}</p>}
              <div className="border-t border-dashed border-black my-1.5"></div>
            </div>

            {/* Line Items */}
            <table className="w-full text-[10px] text-left rtl:text-right border-collapse">
              <thead>
                <tr className="border-b border-black">
                  <th className="py-1">Item</th>
                  <th className="py-1 text-center">Qty</th>
                  <th className="py-1 text-right rtl:text-left">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dotted divide-gray-300">
                {completedSale?.items?.map((it: SaleItem, idx: number) => (
                  <tr key={idx}>
                    <td className="py-1">{lang === 'ar' ? it.product_name_ar : it.product_name_en}</td>
                    <td className="py-1 text-center">{it.quantity}</td>
                    <td className="py-1 text-right rtl:text-left">{it.line_total}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="border-t border-dashed border-black my-1.5"></div>

            {/* Totals */}
            <div className="space-y-0.5 text-[11px]">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{completedSale?.subtotal} EGP</span>
              </div>
              {completedSale?.discount_amount ? (
                <div className="flex justify-between">
                  <span>Discount:</span>
                  <span>-{completedSale.discount_amount} EGP</span>
                </div>
              ) : null}
              {vatEnabled && completedSale && Number(completedSale.tax_amount) > 0 ? (
                <div className="flex justify-between">
                  <span>VAT (14%):</span>
                  <span>{completedSale.tax_amount} EGP</span>
                </div>
              ) : null}
              <div className="flex justify-between font-bold text-xs pt-1 border-t border-black">
                <span>TOTAL:</span>
                <span>{completedSale?.total_amount} EGP</span>
              </div>
              <div className="flex justify-between text-[10px] pt-1">
                <span>Payment ({completedSale?.payment_method}):</span>
                <span>{completedSale?.paid_amount} EGP</span>
              </div>
              {completedSale?.change_amount ? (
                <div className="flex justify-between text-[10px]">
                  <span>Change:</span>
                  <span>{completedSale.change_amount} EGP</span>
                </div>
              ) : null}
            </div>

            {/* Footer */}
            <div className="text-center text-[10px] pt-2 border-t border-dashed border-black space-y-2">
              <p>{receiptFooter || 'شكراً لتعاملكم معنا'}</p>
              <div className="flex flex-col items-center justify-center pt-2 border-t border-dotted border-gray-300 space-y-1.5">
                <Image 
                  src="/logo.png" 
                  alt="Sastmhaly Logo" 
                  width={38} 
                  height={38} 
                  className="object-contain" 
                />
                <p className="font-bold text-[11px] tracking-wider text-gray-700">Powered by Sastmhaly</p>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setIsReceiptOpen(false)}
              className="px-4 py-2 rounded-lg border border-[#E5EAF2] text-xs font-bold text-[#687386]"
            >
              {lang === 'ar' ? 'إغلاق ومتابعة البيع' : 'Close & Next Sale'}
            </button>
            <button
              onClick={() => window.print()}
              className="px-4 py-2 rounded-lg bg-[#246BFD] text-white text-xs font-bold flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              <span>{t('print')}</span>
            </button>
          </div>

        </div>
      </Modal>

      {/* Customer Selection Modal with Live Search */}
      <Modal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        title={lang === 'ar' ? 'اختيار عميل الفاتورة والآجل' : 'Select Invoice Customer'}
        size="lg"
      >
        <div className="space-y-3.5 text-xs">
          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute top-2.5 start-3 text-[#687386]" />
            <input
              type="text"
              value={customerModalSearch}
              onChange={(e) => setCustomerModalSearch(e.target.value)}
              placeholder={lang === 'ar' ? 'بحث باسم العميل، الهاتف، أو كود العميل...' : 'Search by name, phone, or code...'}
              autoFocus
              className="w-full ps-9 pe-9 py-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs focus:bg-white focus:border-[#246BFD] outline-none font-medium text-[#0B1730]"
            />
            {customerModalSearch && (
              <button
                onClick={() => setCustomerModalSearch('')}
                className="absolute top-2.5 end-3 text-[#687386] hover:text-black"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Option: General Walk-in Customer */}
          <div
            onClick={() => {
              setSelectedCustomer(null);
              setIsCustomerModalOpen(false);
              posAudio.playBeep();
            }}
            className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
              !selectedCustomer 
                ? 'bg-blue-50/80 border-[#246BFD] shadow-xs ring-1 ring-[#246BFD]' 
                : 'bg-white border-[#E5EAF2] hover:bg-[#F7F9FC]'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-[#687386] shrink-0">
                <User className="w-5 h-5 text-gray-500" />
              </div>
              <div className="text-start">
                <p className="font-bold text-[#0B1730] text-sm">
                  {t('pos_walk_in')} ({lang === 'ar' ? 'عميل نقدي عام' : 'General Customer'})
                </p>
                <p className="text-[11px] text-[#687386] mt-0.5">
                  {lang === 'ar' ? 'دفع نقدي فوري بالصندوق أو فيزا بدون تسجيل ديون أو فتح حساب آجل' : 'Standard walk-in customer without ledger credit'}
                </p>
              </div>
            </div>
            {!selectedCustomer ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-[#246BFD] shrink-0">
                <CheckCircle2 className="w-4 h-4" />
                <span>{lang === 'ar' ? 'محدد حالياً' : 'Selected'}</span>
              </span>
            ) : (
              <button
                type="button"
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-[#0B1730] rounded-lg text-xs font-bold shrink-0 transition-colors"
              >
                {lang === 'ar' ? 'اختيار' : 'Select'}
              </button>
            )}
          </div>

          {/* Customer Cards List */}
          <div className="max-h-80 overflow-y-auto space-y-2 pe-1">
            {customers
              .filter(c =>
                c.name.toLowerCase().includes(customerModalSearch.toLowerCase()) ||
                c.code.toLowerCase().includes(customerModalSearch.toLowerCase()) ||
                c.phone.includes(customerModalSearch)
              )
              .map((c) => {
                const isSelected = selectedCustomer?.id === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => {
                      setSelectedCustomer(c);
                      setIsCustomerModalOpen(false);
                      posAudio.playBeep();
                    }}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between text-start ${
                      isSelected
                        ? 'bg-blue-50/80 border-[#246BFD] shadow-xs ring-1 ring-[#246BFD]'
                        : 'bg-white border-[#E5EAF2] hover:bg-[#F7F9FC]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-[#246BFD]/10 text-[#246BFD] flex items-center justify-center font-black text-sm shrink-0">
                        {c.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-[#0B1730] text-sm truncate">{c.name}</span>
                          <span className="text-[10px] bg-gray-100 text-[#687386] px-1.5 py-0.5 rounded font-mono font-bold">
                            {c.code}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[11px] text-[#687386] flex-wrap">
                          <span className="inline-flex items-center gap-1 font-mono">
                            <Smartphone className="w-3.5 h-3.5 text-[#246BFD]" />
                            <span>{c.phone}</span>
                          </span>
                          <span>•</span>
                          <span>
                            {lang === 'ar' ? 'الحد الائتماني:' : 'Limit:'}{' '}
                            <strong className="text-[#0B1730]">{c.credit_limit.toFixed(0)} EGP</strong>
                          </span>
                          <span>•</span>
                          <span className={c.current_balance > 0 ? 'text-amber-700 font-bold' : 'text-emerald-700 font-bold'}>
                            {lang === 'ar' ? 'المديونية الحالية:' : 'Debt:'}{' '}
                            {c.current_balance.toFixed(2)} EGP
                          </span>
                          <span>•</span>
                          <span className="text-purple-700 font-semibold">
                            {lang === 'ar' ? 'النقاط:' : 'Pts:'} {c.loyalty_points}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 ms-2">
                      {isSelected ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-[#246BFD]">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{lang === 'ar' ? 'محدد' : 'Selected'}</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="px-3.5 py-1.5 bg-[#246BFD] hover:bg-blue-600 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
                        >
                          {lang === 'ar' ? 'اختيار' : 'Select'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

            {customers.filter(c =>
              c.name.toLowerCase().includes(customerModalSearch.toLowerCase()) ||
              c.code.toLowerCase().includes(customerModalSearch.toLowerCase()) ||
              c.phone.includes(customerModalSearch)
            ).length === 0 && (
              <div className="p-8 text-center text-[#687386] space-y-1">
                <Users className="w-8 h-8 mx-auto opacity-40 mb-1" />
                <p className="font-semibold text-xs">{lang === 'ar' ? 'لم يتم العثور على أي عميل بهذا الاسم أو الهاتف' : 'No clients match your search'}</p>
                <p className="text-[11px] text-gray-400">{lang === 'ar' ? 'تأكد من كتابة الاسم أو رقم الهاتف بشكل صحيح' : 'Check spelling or phone number'}</p>
              </div>
            )}
          </div>
        </div>
      </Modal>

    </div>
  );
}
