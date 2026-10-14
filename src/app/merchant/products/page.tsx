'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/context';
import { useLanguage } from '@/lib/i18n/context';
import { Product, Category, Unit } from '@/lib/types';
import { ExportButton } from '@/components/reports/ExportButton';
import { Modal } from '@/components/ui/Modal';
import { 
  Package, Plus, Search, Filter, Upload, Barcode, 
  Scale, CalendarDays, AlertTriangle, CheckCircle2, Download,
  Layers, Edit2, Trash2, X, Check, FolderPlus
} from 'lucide-react';

export default function MerchantProductsPage() {
  const { tenant, activeBranchId } = useAuth();
  const { lang, t } = useLanguage();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [lowStockFilter, setLowStockFilter] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);

  useEffect(() => {
    setVisibleCount(20);
  }, [search, selectedCategory, lowStockFilter]);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importResult, setImportResult] = useState<{ successCount: number; errorCount: number; errors: string[] } | null>(null);

  // Category management modal
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryNameAr, setCategoryNameAr] = useState('');
  const [categoryNameEn, setCategoryNameEn] = useState('');
  const [categoryCode, setCategoryCode] = useState('');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isCategorySubmitting, setIsCategorySubmitting] = useState(false);

  // Edit product modal state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState({
    sku: '',
    barcode: '',
    additional_barcodes: '',
    name_en: '',
    name_ar: '',
    category_id: '',
    unit_id: '',
    cost_price: 10,
    selling_price: 15,
    wholesale_price: 13,
    tax_rate: 14.0,
    min_stock_alert: 5.0,
    current_stock: 0,
    is_weighted: false,
    has_batch_tracking: false,
    is_active: 1,
  });

  // New product form
  const [formData, setFormData] = useState({
    sku: '',
    barcode: '',
    additional_barcodes: '',
    name_en: '',
    name_ar: '',
    category_id: '',
    unit_id: '',
    cost_price: 10,
    selling_price: 15,
    wholesale_price: 13,
    tax_rate: 14.0,
    min_stock_alert: 5.0,
    is_weighted: false,
    has_batch_tracking: false,
    initial_stock: 50,
  });

  const fetchProducts = async () => {
    if (!tenant) return;
    try {
      setLoading(true);
      const branchParam = activeBranchId !== 'all' ? `&branchId=${activeBranchId}` : '';
      const res = await fetch(`/api/merchant/products?tenantId=${tenant.id}${branchParam}`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
        setCategories(data.categories || []);
        setUnits(data.units || []);
        if (data.categories?.length > 0 && !formData.category_id) {
          setFormData(f => ({ ...f, category_id: data.categories[0].id, unit_id: data.units[0]?.id || '' }));
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [tenant, activeBranchId]);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) return;

    try {
      const payload = {
        tenant_id: tenant.id,
        branch_id: activeBranchId !== 'all' ? activeBranchId : 'br_downtown',
        ...formData,
        cost_price: Number(formData.cost_price),
        selling_price: Number(formData.selling_price),
        wholesale_price: Number(formData.wholesale_price),
        tax_rate: Number(formData.tax_rate),
        min_stock_alert: Number(formData.min_stock_alert),
        initial_stock: Number(formData.initial_stock),
        is_weighted: formData.is_weighted ? 1 : 0,
        has_batch_tracking: formData.has_batch_tracking ? 1 : 0,
      };

      const res = await fetch('/api/merchant/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setIsCreateOpen(false);
        fetchProducts();
        setFormData({
          sku: '',
          barcode: '',
          additional_barcodes: '',
          name_en: '',
          name_ar: '',
          category_id: categories[0]?.id || '',
          unit_id: units[0]?.id || '',
          cost_price: 10,
          selling_price: 15,
          wholesale_price: 13,
          tax_rate: 14.0,
          min_stock_alert: 5.0,
          is_weighted: false,
          has_batch_tracking: false,
          initial_stock: 50,
        });
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to create product');
      }
    } catch {
      alert('Error connecting to server');
    }
  };

  const openEditModal = (p: Product) => {
    setEditingProductId(p.id);
    setEditFormData({
      sku: p.sku || '',
      barcode: p.barcode || '',
      additional_barcodes: p.additional_barcodes || '',
      name_en: p.name_en || '',
      name_ar: p.name_ar || '',
      category_id: p.category_id || (categories[0]?.id || ''),
      unit_id: p.unit_id || (units[0]?.id || ''),
      cost_price: p.cost_price ?? 0,
      selling_price: p.selling_price ?? 0,
      wholesale_price: p.wholesale_price ?? 0,
      tax_rate: p.tax_rate ?? 14.0,
      min_stock_alert: p.min_stock_alert ?? 5.0,
      current_stock: p.current_stock ?? 0,
      is_weighted: p.is_weighted === 1,
      has_batch_tracking: p.has_batch_tracking === 1,
      is_active: p.is_active ?? 1,
    });
    setIsEditOpen(true);
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant || !editingProductId) return;

    try {
      const payload = {
        tenant_id: tenant.id,
        id: editingProductId,
        branch_id: activeBranchId !== 'all' ? activeBranchId : undefined,
        ...editFormData,
        current_stock: Number(editFormData.current_stock),
        cost_price: Number(editFormData.cost_price),
        selling_price: Number(editFormData.selling_price),
        wholesale_price: Number(editFormData.wholesale_price),
        tax_rate: Number(editFormData.tax_rate),
        min_stock_alert: Number(editFormData.min_stock_alert),
        is_weighted: editFormData.is_weighted ? 1 : 0,
        has_batch_tracking: editFormData.has_batch_tracking ? 1 : 0,
        is_active: editFormData.is_active,
      };

      const res = await fetch('/api/merchant/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setIsEditOpen(false);
        setEditingProductId(null);
        fetchProducts();
      } else {
        const err = await res.json();
        alert(err.error || (lang === 'ar' ? 'فشل تعديل بيانات الصنف' : 'Failed to update product'));
      }
    } catch {
      alert(lang === 'ar' ? 'خطأ في الاتصال بالخادم' : 'Error updating product');
    }
  };

  // Hardware Barcode Scanner Auto-Detection on Products Page
  // When Add Product or Edit Product modal is open, scanner input automatically populates barcode field without needing focus
  useEffect(() => {
    let scanBuffer = '';
    let lastKeyTime = 0;

    const handleGlobalScan = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || (e.key.startsWith('F') && e.key.length > 1)) return;

      const now = Date.now();
      const timeDiff = now - lastKeyTime;

      if (e.key === 'Enter') {
        if (scanBuffer.length >= 3 && timeDiff < 80) {
          e.preventDefault();
          e.stopPropagation();
          const scannedCode = scanBuffer.trim();
          scanBuffer = '';

          if (isCreateOpen) {
            setFormData(prev => ({ ...prev, barcode: scannedCode }));
          } else if (isEditOpen) {
            setEditFormData(prev => ({ ...prev, barcode: scannedCode }));
          }
          return;
        }
        scanBuffer = '';
        return;
      }

      if (e.key.length === 1) {
        if (timeDiff > 80) {
          scanBuffer = e.key;
        } else {
          scanBuffer += e.key;
        }
        lastKeyTime = now;
      }
    };

    window.addEventListener('keydown', handleGlobalScan, true);
    return () => window.removeEventListener('keydown', handleGlobalScan, true);
  }, [isCreateOpen, isEditOpen]);

  const handleDeleteProduct = async (p: Product) => {
    if (!tenant) return;
    const confirmMsg = lang === 'ar'
      ? `هل أنت متأكد من حذف المنتج "${p.name_ar || p.name_en}"؟`
      : `Are you sure you want to delete "${p.name_en || p.name_ar}"?`;
    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch(`/api/merchant/products?id=${p.id}&tenantId=${tenant.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchProducts();
      } else {
        const err = await res.json();
        alert(err.error || (lang === 'ar' ? 'فشل حذف الصنف' : 'Failed to delete product'));
      }
    } catch {
      alert(lang === 'ar' ? 'خطأ في الاتصال بالخادم' : 'Error deleting product');
    }
  };

  // Bulk CSV Import parser
  const handleBulkImport = async () => {
    if (!importText.trim() || !tenant) return;
    const lines = importText.trim().split('\n');
    if (lines.length < 2) {
      alert('Please provide headers and at least one data row');
      return;
    }

    const items = [];
    // Format: sku,barcode,name_en,name_ar,cost_price,selling_price,min_stock
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
      if (parts.length >= 6) {
        items.push({
          sku: parts[0] || `SKU-${Date.now()}-${i}`,
          barcode: parts[1] || `${Date.now()}${i}`,
          name_en: parts[2],
          name_ar: parts[3],
          category_id: categories[0]?.id || 'cat_grocery',
          unit_id: units[0]?.id || 'unit_piece',
          cost_price: parseFloat(parts[4]) || 10,
          selling_price: parseFloat(parts[5]) || 15,
          min_stock_alert: parseFloat(parts[6]) || 5,
          initial_stock: 20,
          branch_id: activeBranchId !== 'all' ? activeBranchId : 'br_downtown',
        });
      }
    }

    try {
      const res = await fetch('/api/merchant/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenant.id,
          bulk: true,
          items,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setImportResult(data);
        fetchProducts();
      }
    } catch (e) {
      alert('Failed to process bulk import');
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryNameAr.trim() || !tenant) return;
    setIsCategorySubmitting(true);
    try {
      if (editingCategory) {
        const res = await fetch('/api/merchant/categories', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingCategory.id,
            tenant_id: tenant.id,
            name_ar: categoryNameAr.trim(),
            name_en: categoryNameEn.trim() || categoryNameAr.trim(),
            code: categoryCode.trim() || undefined,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setEditingCategory(null);
          setCategoryNameAr('');
          setCategoryNameEn('');
          setCategoryCode('');
          fetchProducts();
        } else {
          alert(data.error || 'Failed to update category');
        }
      } else {
        const res = await fetch('/api/merchant/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenant_id: tenant.id,
            name_ar: categoryNameAr.trim(),
            name_en: categoryNameEn.trim() || categoryNameAr.trim(),
            code: categoryCode.trim() || undefined,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setCategoryNameAr('');
          setCategoryNameEn('');
          setCategoryCode('');
          fetchProducts();
        } else {
          alert(data.error || 'Failed to create category');
        }
      }
    } catch {
      alert('Error saving category');
    } finally {
      setIsCategorySubmitting(false);
    }
  };

  const handleDeleteCategory = async (cat: Category) => {
    if (!tenant) return;
    const confirmMsg = lang === 'ar'
      ? `هل أنت متأكد من حذف قسم "${cat.name_ar}"؟`
      : `Are you sure you want to delete category "${cat.name_en}"?`;
    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch(`/api/merchant/categories?id=${cat.id}&tenantId=${tenant.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        fetchProducts();
      } else {
        alert(data.error || 'Failed to delete category');
      }
    } catch {
      alert('Error deleting category');
    }
  };

  const sampleCsvTemplate = `sku,barcode,name_en,name_ar,cost_price,selling_price,min_stock
SKU-501,6221199001122,Fine Facial Tissues 550,مناديل فاين كلاسيك 550 منديل,35.0,45.0,10
SKU-502,6221088003344,Ariel Powder Detergent 2.5kg,مسحوق غسيل أوتوماتيك أريال 2.5 كجم,160.0,195.0,8
SKU-503,6221077004455,Molto Croissant Chocolate,مولتو كرواسون شوكولاتة ماكس,9.0,12.0,24`;

  const filtered = products.filter(p => {
    const matchesCategory = selectedCategory === 'all' || p.category_id === selectedCategory;
    const matchesSearch = search === '' ||
      p.name_en.toLowerCase().includes(search.toLowerCase()) ||
      p.name_ar.includes(search) ||
      p.barcode.includes(search) ||
      p.sku.toLowerCase().includes(search.toLowerCase());
    const matchesStock = !lowStockFilter || (p.current_stock !== undefined && p.current_stock <= p.min_stock_alert);
    return matchesCategory && matchesSearch && matchesStock;
  });

  const exportColumns = [
    { header: 'SKU', key: 'sku' as const },
    { header: 'Barcode', key: 'barcode' as const },
    { header: 'Name (EN)', key: 'name_en' as const },
    { header: 'Name (AR)', key: 'name_ar' as const },
    { header: 'Category', key: (r: Product) => r.category_name_en || '' },
    { header: 'Cost Price', key: 'cost_price' as const },
    { header: 'Selling Price', key: 'selling_price' as const },
    { header: 'Tax %', key: 'tax_rate' as const },
    { header: 'Stock on Hand', key: (r: Product) => r.current_stock ?? 0 },
    { header: 'Min Alert', key: 'min_stock_alert' as const },
  ];

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#0B1730]">
            {lang === 'ar' ? 'كتالوج الأصناف والمنتجات' : 'Products & Catalog Management'}
          </h2>
          <p className="text-xs text-[#687386] mt-0.5">
            {lang === 'ar' 
              ? 'إدارة الأسعار، الباركود المتعدد، الأصناف الموزونة، وتواريخ الصلاحية' 
              : 'SKUs, multiple barcodes, scale produce weights, pricing, and stock thresholds'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <ExportButton
            filename="sastmhaly_products_catalog"
            data={filtered}
            columns={exportColumns}
          />

          <button
            onClick={() => {
              setEditingCategory(null);
              setCategoryNameAr('');
              setCategoryNameEn('');
              setCategoryCode('');
              setIsCategoryModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5EAF2] bg-white text-xs font-semibold text-[#172033] hover:bg-[#F7F9FC] transition-colors cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-[#246BFD]" />
            <span>{lang === 'ar' ? 'إدارة الأقسام (Categories)' : 'Manage Categories'}</span>
          </button>

          <button
            onClick={() => {
              setImportText(sampleCsvTemplate);
              setIsImportOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5EAF2] bg-white text-xs font-semibold text-[#172033] hover:bg-[#F7F9FC] transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-[#10B981]" />
            <span>{lang === 'ar' ? 'استيراد CSV' : 'Import CSV'}</span>
          </button>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-[#246BFD] hover:bg-[#1A54D4] transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{lang === 'ar' ? 'إضافة صنف جديد' : 'Add Product'}</span>
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white p-4 rounded-xl border border-[#E5EAF2] flex flex-col md:flex-row items-center justify-between gap-3 shadow-2xs">
        <div className="relative w-full md:w-80">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={lang === 'ar' ? 'بحث بالاسم، الباركود، أو SKU...' : 'Search by name, barcode, SKU...'}
            className="w-full px-3.5 py-2 rounded-lg border border-[#E5EAF2] bg-[#F7F9FC] text-xs text-[#172033] focus:bg-white focus:border-[#246BFD] focus:outline-none pl-9 rtl:pl-3 rtl:pr-9"
          />
          <Search className="w-4 h-4 text-[#687386] absolute left-3 rtl:left-auto rtl:right-3 top-2.5 pointer-events-none" />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 rounded-lg border border-[#E5EAF2] bg-[#F7F9FC] text-xs font-semibold text-[#0B1730] focus:outline-none cursor-pointer"
          >
            <option value="all">{t('pos_category_all')}</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>
                {lang === 'ar' ? c.name_ar : c.name_en}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-2 text-xs font-semibold text-[#172033] cursor-pointer bg-[#F7F9FC] px-3 py-2 rounded-lg border border-[#E5EAF2]">
            <input
              type="checkbox"
              checked={lowStockFilter}
              onChange={(e) => setLowStockFilter(e.target.checked)}
              className="w-4 h-4 text-[#EF4444] rounded"
            />
            <span className={lowStockFilter ? 'text-[#EF4444]' : ''}>
              {lang === 'ar' ? 'نواقص المخزون فقط' : 'Low Stock Only'}
            </span>
          </label>
        </div>
      </div>

      {/* Catalog Table */}
      <div className="bg-white rounded-xl border border-[#E5EAF2] overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left rtl:text-right border-collapse">
            <thead className="bg-[#F7F9FC] border-b border-[#E5EAF2] text-[#687386] uppercase font-bold text-[11px]">
              <tr>
                <th className="px-4 py-3.5">#</th>
                <th className="px-4 py-3.5">{lang === 'ar' ? 'اسم الصنف' : 'Product Name'}</th>
                <th className="px-4 py-3.5">{lang === 'ar' ? 'الكود / الباركود' : 'SKU / Barcode'}</th>
                <th className="px-4 py-3.5">{lang === 'ar' ? 'القسم' : 'Category'}</th>
                <th className="px-4 py-3.5 text-right rtl:text-left">{lang === 'ar' ? 'سعر التكلفة' : 'Cost'}</th>
                <th className="px-4 py-3.5 text-right rtl:text-left">{lang === 'ar' ? 'سعر البيع' : 'Selling Price'}</th>
                <th className="px-4 py-3.5 text-center">{lang === 'ar' ? 'رصيد الفرع' : 'Stock on Hand'}</th>
                <th className="px-4 py-3.5 text-center">{lang === 'ar' ? 'النوع' : 'Type'}</th>
                <th className="px-4 py-3.5 text-center">{lang === 'ar' ? 'الإجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5EAF2]">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-[#687386]">
                    {t('loading')}
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-[#687386]">
                    {t('no_records')}
                  </td>
                </tr>
              ) : (
                filtered.slice(0, visibleCount).map((p, idx) => {
                  const isLow = p.current_stock !== undefined && p.current_stock <= p.min_stock_alert;
                  return (
                    <tr key={p.id} className="hover:bg-[#F7F9FC] transition-colors">
                      <td className="px-4 py-3.5 font-mono text-[#687386]">{idx + 1}</td>
                      <td className="px-4 py-3.5">
                        <div>
                          <p className="font-bold text-[#0B1730]">{lang === 'ar' ? p.name_ar : p.name_en}</p>
                          <p className="text-[10px] text-[#687386]">{lang === 'ar' ? p.name_en : p.name_ar}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-mono">
                        <span className="font-bold text-[#0B1730]">{p.sku}</span>
                        <div className="text-[10px] text-[#687386] flex items-center gap-1">
                          <Barcode className="w-3 h-3 text-[#246BFD]" />
                          <span>{p.barcode}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-[#172033] font-medium">
                        {lang === 'ar' ? p.category_name_ar : p.category_name_en}
                      </td>
                      <td className="px-4 py-3.5 text-right rtl:text-left font-mono text-[#687386]">
                        {p.cost_price.toFixed(2)}
                      </td>
                      <td className="px-4 py-3.5 text-right rtl:text-left font-mono font-bold text-[#0B1730]">
                        {p.selling_price.toFixed(2)} {t('currency')}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold font-mono ${
                          isLow ? 'bg-[#FEF2F2] text-[#EF4444] border border-[#FECACA]' : 'bg-[#ECFDF5] text-[#10B981] border border-[#A7F3D0]'
                        }`}>
                          {p.current_stock ?? 0} {p.unit_name_en || 'PCS'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {p.is_weighted === 1 ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FEF3C7] text-[#D97706]">
                            Weight (KG)
                          </span>
                        ) : p.has_batch_tracking === 1 ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#F0F9FF] text-[#0284C7]">
                            Batch/Expiry
                          </span>
                        ) : (
                          <span className="text-[#687386] text-[10px]">Standard</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(p)}
                            title={lang === 'ar' ? 'تعديل الصنف' : 'Edit Product'}
                            className="p-1.5 rounded-lg text-[#246BFD] hover:bg-[#EEF4FF] transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(p)}
                            title={lang === 'ar' ? 'حذف الصنف' : 'Delete Product'}
                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {visibleCount < filtered.length && (
          <div className="p-4 border-t border-[#E5EAF2] flex justify-center bg-[#FAFCFF]">
            <button
              onClick={() => setVisibleCount(prev => prev + 20)}
              className="px-6 py-2 bg-[#246BFD] hover:bg-[#1A54D4] text-white text-xs font-bold rounded-lg shadow-sm transition-all"
            >
              {lang === 'ar' ? `عرض المزيد (تحميل 20 إضافية - متبقي ${filtered.length - visibleCount})` : `Load More (+20 items - ${filtered.length - visibleCount} remaining)`}
            </button>
          </div>
        )}
      </div>

      {/* Add Product Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title={lang === 'ar' ? 'إضافة صنف جديد للكتالوج' : 'Add New Catalog Product'}
        maxWidth="xl"
      >
        <form onSubmit={handleCreateProduct} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-[#172033] mb-1">Product Name (Arabic) *</label>
              <input
                type="text"
                required
                value={formData.name_ar}
                onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                placeholder="حليب جهينة 1 لتر"
                className="w-full px-3 py-2 rounded-lg border border-[#E5EAF2] focus:border-[#246BFD] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#172033] mb-1">Product Name (English) *</label>
              <input
                type="text"
                required
                value={formData.name_en}
                onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                placeholder="Juhayna Milk 1L"
                className="w-full px-3 py-2 rounded-lg border border-[#E5EAF2] focus:border-[#246BFD] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#172033] mb-1">SKU Code *</label>
              <input
                type="text"
                required
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                placeholder="SKU-100"
                className="w-full px-3 py-2 rounded-lg border border-[#E5EAF2] font-mono focus:border-[#246BFD] focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-semibold text-[#172033]">
                  {lang === 'ar' ? 'الباركود الرئيسي *' : 'Primary Barcode *'}
                </label>
                <span className="text-[10px] text-[#246BFD] font-medium bg-[#EEF4FF] px-1.5 py-0.5 rounded">
                  {lang === 'ar' ? 'يدعم المسح المباشر بالماسح' : 'Scanner auto-detects'}
                </span>
              </div>
              <input
                type="text"
                required
                value={formData.barcode}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                placeholder="6221155010012"
                className="w-full px-3 py-2 rounded-lg border border-[#E5EAF2] font-mono focus:border-[#246BFD] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#172033] mb-1">Category *</label>
              <select
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5EAF2] font-semibold focus:border-[#246BFD] focus:outline-none cursor-pointer"
              >
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{lang === 'ar' ? c.name_ar : c.name_en}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-[#172033] mb-1">Unit of Measure *</label>
              <select
                value={formData.unit_id}
                onChange={(e) => setFormData({ ...formData, unit_id: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5EAF2] font-semibold focus:border-[#246BFD] focus:outline-none cursor-pointer"
              >
                {units.map(u => (
                  <option key={u.id} value={u.id}>{lang === 'ar' ? u.name_ar : u.name_en}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-[#172033] mb-1">Purchase Cost ({t('currency')}) *</label>
              <input
                type="number"
                step="0.25"
                required
                value={formData.cost_price}
                onChange={(e) => setFormData({ ...formData, cost_price: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5EAF2] font-mono focus:border-[#246BFD] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#172033] mb-1">Selling Price ({t('currency')}) *</label>
              <input
                type="number"
                step="0.25"
                required
                value={formData.selling_price}
                onChange={(e) => setFormData({ ...formData, selling_price: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5EAF2] font-mono font-bold focus:border-[#246BFD] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#172033] mb-1">Initial Opening Stock</label>
              <input
                type="number"
                value={formData.initial_stock}
                onChange={(e) => setFormData({ ...formData, initial_stock: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5EAF2] font-mono focus:border-[#246BFD] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#172033] mb-1">Low Stock Alert Threshold</label>
              <input
                type="number"
                value={formData.min_stock_alert}
                onChange={(e) => setFormData({ ...formData, min_stock_alert: parseFloat(e.target.value) || 5 })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5EAF2] font-mono focus:border-[#246BFD] focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center gap-6 text-xs">
            <label className="flex items-center gap-2 cursor-pointer font-medium">
              <input
                type="checkbox"
                checked={formData.is_weighted}
                onChange={(e) => setFormData({ ...formData, is_weighted: e.target.checked })}
                className="w-4 h-4 text-[#246BFD] rounded"
              />
              <span>Produce / Weighted Scale Item (يباع بالوزن)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer font-medium">
              <input
                type="checkbox"
                checked={formData.has_batch_tracking}
                onChange={(e) => setFormData({ ...formData, has_batch_tracking: e.target.checked })}
                className="w-4 h-4 text-[#246BFD] rounded"
              />
              <span>Batch & Expiry Tracking (تتبع تاريخ الصلاحية)</span>
            </label>
          </div>

          <div className="pt-3 border-t border-[#E5EAF2] flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 rounded-lg border border-[#E5EAF2] text-xs font-bold text-[#687386]"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#246BFD] hover:bg-[#1A54D4] text-white text-xs font-bold"
            >
              {t('save')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Product Modal */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setEditingProductId(null);
        }}
        title={lang === 'ar' ? 'تعديل بيانات الصنف' : 'Edit Product'}
        maxWidth="xl"
      >
        <form onSubmit={handleUpdateProduct} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-[#172033] mb-1">{lang === 'ar' ? 'اسم الصنف (عربي) *' : 'Product Name (Arabic) *'}</label>
              <input
                type="text"
                required
                value={editFormData.name_ar}
                onChange={(e) => setEditFormData({ ...editFormData, name_ar: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5EAF2] focus:border-[#246BFD] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#172033] mb-1">{lang === 'ar' ? 'اسم الصنف (إنجليزي) *' : 'Product Name (English) *'}</label>
              <input
                type="text"
                required
                value={editFormData.name_en}
                onChange={(e) => setEditFormData({ ...editFormData, name_en: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5EAF2] focus:border-[#246BFD] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#172033] mb-1">{lang === 'ar' ? 'رمز SKU *' : 'SKU Code *'}</label>
              <input
                type="text"
                required
                value={editFormData.sku}
                onChange={(e) => setEditFormData({ ...editFormData, sku: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5EAF2] font-mono focus:border-[#246BFD] focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-semibold text-[#172033]">
                  {lang === 'ar' ? 'الباركود الرئيسي *' : 'Primary Barcode *'}
                </label>
                <span className="text-[10px] text-[#246BFD] font-medium bg-[#EEF4FF] px-1.5 py-0.5 rounded">
                  {lang === 'ar' ? 'يدعم المسح المباشر بالماسح' : 'Scanner auto-detects'}
                </span>
              </div>
              <input
                type="text"
                required
                value={editFormData.barcode}
                onChange={(e) => setEditFormData({ ...editFormData, barcode: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5EAF2] font-mono focus:border-[#246BFD] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#172033] mb-1">{lang === 'ar' ? 'القسم *' : 'Category *'}</label>
              <select
                value={editFormData.category_id}
                onChange={(e) => setEditFormData({ ...editFormData, category_id: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5EAF2] font-semibold focus:border-[#246BFD] focus:outline-none cursor-pointer"
              >
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{lang === 'ar' ? c.name_ar : c.name_en}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-[#172033] mb-1">{lang === 'ar' ? 'وحدة القياس *' : 'Unit of Measure *'}</label>
              <select
                value={editFormData.unit_id}
                onChange={(e) => setEditFormData({ ...editFormData, unit_id: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5EAF2] font-semibold focus:border-[#246BFD] focus:outline-none cursor-pointer"
              >
                {units.map(u => (
                  <option key={u.id} value={u.id}>{lang === 'ar' ? u.name_ar : u.name_en}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-[#172033] mb-1">{lang === 'ar' ? 'سعر الشراء / التكلفة *' : 'Purchase Cost *'}</label>
              <input
                type="number"
                step="0.25"
                required
                value={editFormData.cost_price}
                onChange={(e) => setEditFormData({ ...editFormData, cost_price: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5EAF2] font-mono focus:border-[#246BFD] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#172033] mb-1">{lang === 'ar' ? 'سعر البيع للقطاعي *' : 'Selling Price *'}</label>
              <input
                type="number"
                step="0.25"
                required
                value={editFormData.selling_price}
                onChange={(e) => setEditFormData({ ...editFormData, selling_price: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5EAF2] font-mono font-bold focus:border-[#246BFD] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#172033] mb-1">{lang === 'ar' ? 'سعر الجملة' : 'Wholesale Price'}</label>
              <input
                type="number"
                step="0.25"
                value={editFormData.wholesale_price}
                onChange={(e) => setEditFormData({ ...editFormData, wholesale_price: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5EAF2] font-mono focus:border-[#246BFD] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#172033] mb-1">{lang === 'ar' ? 'حد تنبيه انخفاض المخزون' : 'Low Stock Alert Threshold'}</label>
              <input
                type="number"
                value={editFormData.min_stock_alert}
                onChange={(e) => setEditFormData({ ...editFormData, min_stock_alert: parseFloat(e.target.value) || 5 })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5EAF2] font-mono focus:border-[#246BFD] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#172033] mb-1">
                {lang === 'ar' ? 'رصيد المخزون الحالي بالفرع (Stock on Hand) *' : 'Current Stock on Hand *'}
              </label>
              <input
                type="number"
                step="1"
                required
                value={editFormData.current_stock}
                onChange={(e) => setEditFormData({ ...editFormData, current_stock: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-lg border border-[#246BFD]/40 font-mono font-bold text-[#0B1730] bg-[#EEF4FF]/30 focus:border-[#246BFD] focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-2 flex flex-wrap items-center gap-6 text-xs">
            <label className="flex items-center gap-2 cursor-pointer font-medium">
              <input
                type="checkbox"
                checked={editFormData.is_weighted}
                onChange={(e) => setEditFormData({ ...editFormData, is_weighted: e.target.checked })}
                className="w-4 h-4 text-[#246BFD] rounded"
              />
              <span>{lang === 'ar' ? 'يباع بالوزن (ميزان)' : 'Produce / Weighted Scale Item'}</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer font-medium">
              <input
                type="checkbox"
                checked={editFormData.has_batch_tracking}
                onChange={(e) => setEditFormData({ ...editFormData, has_batch_tracking: e.target.checked })}
                className="w-4 h-4 text-[#246BFD] rounded"
              />
              <span>{lang === 'ar' ? 'تتبع تاريخ الصلاحية والتشغيلة' : 'Batch & Expiry Tracking'}</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer font-medium">
              <input
                type="checkbox"
                checked={editFormData.is_active === 1}
                onChange={(e) => setEditFormData({ ...editFormData, is_active: e.target.checked ? 1 : 0 })}
                className="w-4 h-4 text-[#246BFD] rounded"
              />
              <span>{lang === 'ar' ? 'صنف نشط' : 'Active Product'}</span>
            </label>
          </div>

          <div className="pt-3 border-t border-[#E5EAF2] flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setIsEditOpen(false);
                setEditingProductId(null);
              }}
              className="px-4 py-2 rounded-lg border border-[#E5EAF2] text-xs font-bold text-[#687386]"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#246BFD] hover:bg-[#1A54D4] text-white text-xs font-bold"
            >
              {t('save')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Bulk CSV Import Modal */}
      <Modal
        isOpen={isImportOpen}
        onClose={() => {
          setIsImportOpen(false);
          setImportResult(null);
        }}
        title={lang === 'ar' ? 'استيراد أصناف جماعي من ملف CSV' : 'Bulk Product CSV Import'}
        maxWidth="lg"
      >
        <div className="space-y-4 text-xs">
          <p className="text-[#687386]">
            Paste your CSV rows below or edit the sample template. Headers must match:
            <code className="block mt-1 font-mono text-[11px] bg-gray-100 p-1.5 rounded">
              sku,barcode,name_en,name_ar,cost_price,selling_price,min_stock
            </code>
          </p>

          <textarea
            rows={8}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            className="w-full p-3 rounded-lg border border-[#CBD5E1] font-mono text-xs focus:border-[#246BFD] focus:outline-none"
          />

          {importResult && (
            <div className={`p-3 rounded-lg ${importResult.errorCount === 0 ? 'bg-[#ECFDF5] text-[#10B981]' : 'bg-[#FFFBEB] text-[#B45309]'}`}>
              <p className="font-bold">
                ✓ Successfully imported {importResult.successCount} items!
              </p>
              {importResult.errors.length > 0 && (
                <div className="mt-1 space-y-0.5 text-[11px]">
                  {importResult.errors.map((err, i) => (
                    <p key={i}>• {err}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsImportOpen(false)}
              className="px-4 py-2 rounded-lg border border-[#E5EAF2] font-bold text-[#687386]"
            >
              {t('cancel')}
            </button>
            <button
              type="button"
              onClick={handleBulkImport}
              className="px-4 py-2 rounded-lg bg-[#10B981] hover:bg-[#059669] text-white font-bold"
            >
              {lang === 'ar' ? 'تنفيذ الاستيراد' : 'Execute Import'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Category Management Modal (عرض، إضافة، تعديل، وحذف الأقسام) */}
      <Modal
        isOpen={isCategoryModalOpen}
        onClose={() => {
          setIsCategoryModalOpen(false);
          setEditingCategory(null);
        }}
        title={lang === 'ar' ? 'إدارة أقسام وتصنيفات المنتجات' : 'Product Categories Management'}
        size="lg"
      >
        <div className="space-y-5 text-xs">
          {/* Add / Edit Form */}
          <form onSubmit={handleSaveCategory} className="p-4 bg-[#F7F9FC] border border-[#E5EAF2] rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#0B1730] flex items-center gap-1.5">
                <FolderPlus className="w-4 h-4 text-[#246BFD]" />
                <span>
                  {editingCategory 
                    ? (lang === 'ar' ? `تعديل قسم: ${editingCategory.name_ar}` : `Edit Category: ${editingCategory.name_en}`)
                    : (lang === 'ar' ? 'إضافة قسم جديد' : 'Add New Category')}
                </span>
              </span>
              {editingCategory && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingCategory(null);
                    setCategoryNameAr('');
                    setCategoryNameEn('');
                    setCategoryCode('');
                  }}
                  className="text-xs text-[#EF4444] hover:underline font-semibold"
                >
                  {lang === 'ar' ? 'إلغاء التعديل والعودة للإضافة' : 'Cancel Edit'}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-gray-700 font-semibold mb-1">
                  {lang === 'ar' ? 'اسم القسم (عربي) *' : 'Name (Arabic) *'}
                </label>
                <input
                  type="text"
                  required
                  value={categoryNameAr}
                  onChange={(e) => setCategoryNameAr(e.target.value)}
                  placeholder={lang === 'ar' ? 'مثال: ألبان وأجبان' : 'e.g. Dairy'}
                  className="w-full p-2 bg-white border border-[#E5EAF2] rounded-lg text-xs outline-none focus:border-[#246BFD] font-medium"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-1">
                  {lang === 'ar' ? 'اسم القسم (إنجليزي)' : 'Name (English)'}
                </label>
                <input
                  type="text"
                  value={categoryNameEn}
                  onChange={(e) => setCategoryNameEn(e.target.value)}
                  placeholder="e.g. Dairy & Cheese"
                  className="w-full p-2 bg-white border border-[#E5EAF2] rounded-lg text-xs outline-none focus:border-[#246BFD] font-medium"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-1">
                  {lang === 'ar' ? 'كود القسم' : 'Category Code'}
                </label>
                <input
                  type="text"
                  value={categoryCode}
                  onChange={(e) => setCategoryCode(e.target.value.toUpperCase())}
                  placeholder="e.g. CAT-DAIRY"
                  className="w-full p-2 bg-white border border-[#E5EAF2] rounded-lg text-xs outline-none focus:border-[#246BFD] font-mono font-bold"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isCategorySubmitting}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#246BFD] hover:bg-blue-600 text-white rounded-lg text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
              >
                {editingCategory ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>{isCategorySubmitting ? (lang === 'ar' ? 'جاري الحفظ...' : 'Saving...') : (lang === 'ar' ? 'حفظ تعديلات القسم' : 'Save Changes')}</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isCategorySubmitting ? (lang === 'ar' ? 'جاري الإضافة...' : 'Adding...') : (lang === 'ar' ? 'إضافة القسم' : 'Add Category')}</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Categories List */}
          <div className="space-y-2">
            <h4 className="font-bold text-[#0B1730]">
              {lang === 'ar' ? `الأقسام الحالية (${categories.length})` : `Existing Categories (${categories.length})`}
            </h4>

            <div className="border border-[#E5EAF2] rounded-xl overflow-hidden bg-white max-h-72 overflow-y-auto">
              {categories.length === 0 ? (
                <div className="p-6 text-center text-[#687386]">
                  {lang === 'ar' ? 'لا توجد أقسام مسجلة حتى الآن' : 'No categories found'}
                </div>
              ) : (
                <table className="w-full text-start text-xs">
                  <thead className="bg-[#F7F9FC] text-[#687386] border-b border-[#E5EAF2] font-semibold sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3 text-start">{lang === 'ar' ? 'الكود' : 'Code'}</th>
                      <th className="py-2.5 px-3 text-start">{lang === 'ar' ? 'الاسم بالعربية' : 'Arabic Name'}</th>
                      <th className="py-2.5 px-3 text-start">{lang === 'ar' ? 'الاسم بالإنجليزية' : 'English Name'}</th>
                      <th className="py-2.5 px-3 text-center">{lang === 'ar' ? 'عدد المنتجات' : 'Products'}</th>
                      <th className="py-2.5 px-3 text-end">{lang === 'ar' ? 'الإجراءات' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5EAF2]">
                    {categories.map((cat) => {
                      const count = products.filter(p => p.category_id === cat.id).length;
                      return (
                        <tr key={cat.id} className="hover:bg-[#F7F9FC]/60 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-bold text-[#0B1730]">
                            {cat.code}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-[#172033]">
                            {cat.name_ar}
                          </td>
                          <td className="py-2.5 px-3 text-[#687386]">
                            {cat.name_en}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-[#246BFD]">
                              {count}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-end">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCategory(cat);
                                  setCategoryNameAr(cat.name_ar);
                                  setCategoryNameEn(cat.name_en);
                                  setCategoryCode(cat.code);
                                }}
                                title={lang === 'ar' ? 'تعديل القسم' : 'Edit'}
                                className="p-1.5 hover:bg-gray-100 text-[#246BFD] rounded-lg transition-colors"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteCategory(cat)}
                                title={lang === 'ar' ? 'حذف القسم' : 'Delete'}
                                className="p-1.5 hover:bg-red-50 text-[#EF4444] rounded-lg transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-[#E5EAF2]">
            <button
              type="button"
              onClick={() => setIsCategoryModalOpen(false)}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-[#0B1730] rounded-lg font-bold text-xs"
            >
              {lang === 'ar' ? 'إغلاق' : 'Close'}
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
