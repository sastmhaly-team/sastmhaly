'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/context';
import { useLanguage } from '@/lib/i18n/context';
import { Product, Category, Unit } from '@/lib/types';
import { ExportButton } from '@/components/reports/ExportButton';
import { ImportButton } from '@/components/ui/ImportButton';
import { Modal } from '@/components/ui/Modal';
import { DateRangeFilter } from '@/components/ui/DateRangeFilter';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { fetchWithCache, getCachedData } from '@/lib/cache/client-cache';
import { 
  Package, Plus, Search, Filter, Upload, Barcode, 
  Scale, CalendarDays, AlertTriangle, CheckCircle2, Download,
  Layers, Edit2, Trash2, X, Check, FolderPlus, Printer, Sparkles
} from 'lucide-react';
import { BarcodePrintModal } from '@/components/barcode/BarcodePrintModal';
import { generateRandomBarcode } from '@/lib/barcode/code128';
import JSZip from 'jszip';

export default function MerchantProductsPage() {
  const { tenant, activeBranchId } = useAuth();
  const { lang, t } = useLanguage();
  const confirm = useConfirm();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Barcode Print Modal state
  const [barcodeModalProduct, setBarcodeModalProduct] = useState<Product | null>(null);
  
  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [lowStockFilter, setLowStockFilter] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [visibleCount, setVisibleCount] = useState(20);

  useEffect(() => {
    setVisibleCount(20);
  }, [search, selectedCategory, lowStockFilter]);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importResult, setImportResult] = useState<{ successCount: number; errorCount: number; errors: string[] } | null>(null);
  const [excelPreviewRows, setExcelPreviewRows] = useState<any[]>([]);
  const [importingExcel, setImportingExcel] = useState(false);
  const [excelFileName, setExcelFileName] = useState('');

  // Custom unit & variants for Add Product
  const [createCustomUnit, setCreateCustomUnit] = useState('');
  const [createVariants, setCreateVariants] = useState<{ name: string; price?: number }[]>([]);
  const [newVarName, setNewVarName] = useState('');
  const [newVarPrice, setNewVarPrice] = useState<string>('');

  // Custom unit & variants for Edit Product
  const [editCustomUnit, setEditCustomUnit] = useState('');
  const [editVariants, setEditVariants] = useState<{ name: string; price?: number }[]>([]);
  const [editNewVarName, setEditNewVarName] = useState('');
  const [editNewVarPrice, setEditNewVarPrice] = useState<string>('');

  const currency = tenant?.currency || t('currency');

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
      const branchParam = activeBranchId !== 'all' ? `&branchId=${activeBranchId}` : '';
      const url = `/api/merchant/products?tenantId=${tenant.id}${branchParam}`;

      const cached = getCachedData<any>(url);
      if (cached) {
        if (cached.products) setProducts(cached.products);
        if (cached.categories) setCategories(cached.categories);
        if (cached.units) setUnits(cached.units);
        if (cached.categories?.length > 0 && !formData.category_id) {
          setFormData(f => ({ ...f, category_id: cached.categories[0].id, unit_id: cached.units?.[0]?.id || '' }));
        }
        setLoading(false);
      } else if (products.length === 0) {
        setLoading(true);
      }

      await fetchWithCache<any>(url, (data) => {
        if (data.products) setProducts(data.products);
        if (data.categories) setCategories(data.categories);
        if (data.units) setUnits(data.units);
        if (data.categories?.length > 0 && !formData.category_id) {
          setFormData(f => ({ ...f, category_id: data.categories[0].id, unit_id: data.units?.[0]?.id || '' }));
        }
        setLoading(false);
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [tenant, activeBranchId]);

  const handleOpenCreateModal = () => {
    const generatedSku = `SKU-${Date.now().toString().slice(-6)}`;
    const generatedBarcode = generateRandomBarcode('622');
    setFormData({
      sku: generatedSku,
      barcode: generatedBarcode,
      additional_barcodes: '',
      name_ar: '',
      name_en: '',
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
    setCreateCustomUnit('');
    setCreateVariants([]);
    setNewVarName('');
    setNewVarPrice('');
    setIsCreateOpen(true);
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) return;

    try {
      const finalSku = formData.sku?.trim() || `SKU-${Date.now().toString().slice(-6)}`;
      const payload = {
        tenant_id: tenant.id,
        branch_id: activeBranchId !== 'all' ? activeBranchId : 'br_downtown',
        ...formData,
        sku: finalSku,
        custom_unit: createCustomUnit || undefined,
        variants: createVariants.length > 0 ? createVariants : undefined,
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
        setCreateCustomUnit('');
        setCreateVariants([]);
        setNewVarName('');
        setNewVarPrice('');
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
    setEditCustomUnit((p as any).custom_unit || '');
    setEditVariants(Array.isArray((p as any).variants) ? (p as any).variants : []);
    setEditNewVarName('');
    setEditNewVarPrice('');
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
        custom_unit: editCustomUnit || undefined,
        variants: editVariants.length > 0 ? editVariants : undefined,
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

  // Excel / CSV File parser for Import Modal
  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelFileName(file.name);
    setImportResult(null);

    try {
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const zip = await JSZip.loadAsync(file);
        const sharedStrings: string[] = [];
        const ssFile = zip.file('xl/sharedStrings.xml');
        if (ssFile) {
          const ssXml = await ssFile.async('text');
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(ssXml, 'application/xml');
          const siElements = xmlDoc.getElementsByTagName('si');
          for (let i = 0; i < siElements.length; i++) {
            sharedStrings.push(siElements[i].textContent || '');
          }
        }

        const sheetFile = zip.file('xl/worksheets/sheet1.xml') || zip.file('xl/worksheets/sheet.xml');
        if (!sheetFile) {
          alert('Could not find sheet in Excel file');
          return;
        }
        const sheetXml = await sheetFile.async('text');
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(sheetXml, 'application/xml');
        const rowElements = xmlDoc.getElementsByTagName('row');
        const parsedItems: any[] = [];

        for (let r = 1; r < rowElements.length; r++) { // skip header
          const row = rowElements[r];
          const cells = row.getElementsByTagName('c');
          const rowVals: string[] = [];
          for (let c = 0; c < cells.length; c++) {
            const cell = cells[c];
            const type = cell.getAttribute('t');
            const v = cell.getElementsByTagName('v')[0]?.textContent || '';
            const val = type === 's' ? (sharedStrings[parseInt(v, 10)] ?? v) : v;
            rowVals.push(val);
          }
          if (rowVals.length >= 2) {
            parsedItems.push({
              sku: rowVals[0] || `SKU-${Date.now()}-${r}`,
              barcode: rowVals[1] || `${Date.now()}${r}`,
              name_ar: rowVals[2] || rowVals[3] || 'صنف جديد',
              name_en: rowVals[3] || rowVals[2] || 'New Item',
              cost_price: parseFloat(rowVals[4]) || 10,
              selling_price: parseFloat(rowVals[5]) || 15,
              min_stock_alert: parseFloat(rowVals[6]) || 5,
              initial_stock: parseFloat(rowVals[7]) || 20,
              category_id: categories[0]?.id || 'cat_grocery',
              unit_id: units[0]?.id || 'unit_piece',
              branch_id: activeBranchId !== 'all' ? activeBranchId : 'br_downtown',
            });
          }
        }
        setExcelPreviewRows(parsedItems);
      } else {
        const text = await file.text();
        setImportText(text);
        const lines = text.trim().split('\n');
        const parsedItems: any[] = [];
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
          if (parts.length >= 4) {
            parsedItems.push({
              sku: parts[0] || `SKU-${Date.now()}-${i}`,
              barcode: parts[1] || `${Date.now()}${i}`,
              name_ar: parts[3] || parts[2] || 'صنف جديد',
              name_en: parts[2] || parts[3] || 'New Item',
              cost_price: parseFloat(parts[4]) || 10,
              selling_price: parseFloat(parts[5]) || 15,
              min_stock_alert: parseFloat(parts[6]) || 5,
              initial_stock: 20,
              category_id: categories[0]?.id || 'cat_grocery',
              unit_id: units[0]?.id || 'unit_piece',
              branch_id: activeBranchId !== 'all' ? activeBranchId : 'br_downtown',
            });
          }
        }
        setExcelPreviewRows(parsedItems);
      }
    } catch (err) {
      console.error('Error parsing excel file', err);
      alert('فشل قراءة ملف الإكسيل. تأكد من سلامة الملف.');
    }
  };

  const handleExecuteExcelImport = async () => {
    if (excelPreviewRows.length === 0 || !tenant) return;
    setImportingExcel(true);
    try {
      const res = await fetch('/api/merchant/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenant.id,
          bulk: true,
          items: excelPreviewRows,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setImportResult(data);
        setExcelPreviewRows([]);
        fetchProducts();
      } else {
        const err = await res.json();
        alert(err.error || 'فشل الاستيراد');
      }
    } catch (err) {
      alert('خطأ أثناء رفع البيانات');
    } finally {
      setImportingExcel(false);
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
    const ok = await confirm(confirmMsg);
    if (!ok) return;

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
    const ok = await confirm(confirmMsg);
    if (!ok) return;

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
    const matchesDate = (() => {
      if (!startDate && !endDate) return true;
      const pDate = p.created_at ? p.created_at.split('T')[0] : '';
      if (!pDate) return true;
      if (startDate && pDate < startDate) return false;
      if (endDate && pDate > endDate) return false;
      return true;
    })();
    return matchesCategory && matchesSearch && matchesStock && matchesDate;
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

          <ImportButton
            entityNameAr="المنتجات والأصناف"
            entityNameEn="Products"
            columns={[
              { key: 'name_ar', labelAr: 'اسم الصنف بالعربي', labelEn: 'Arabic Name', required: true, example: 'شاي العروسة 250 جم' },
              { key: 'name_en', labelAr: 'اسم الصنف بالإنجليزي', labelEn: 'English Name', required: true, example: 'El-Aroosa Tea 250g' },
              { key: 'barcode', labelAr: 'الباركود الدولي', labelEn: 'Barcode', required: true, example: '6221000123456' },
              { key: 'sku', labelAr: 'كود التخزين (SKU)', labelEn: 'SKU Code', example: 'TEA-001' },
              { key: 'selling_price', labelAr: 'سعر البيع', labelEn: 'Selling Price', required: true, example: '35.00' },
              { key: 'cost_price', labelAr: 'سعر التكلفة', labelEn: 'Cost Price', example: '28.00' },
              { key: 'min_stock_alert', labelAr: 'حد التنبيه', labelEn: 'Min Stock Alert', example: '5' },
              { key: 'initial_stock', labelAr: 'الرصيد الابتدائي', labelEn: 'Initial Stock', example: '25' },
            ]}
            apiEndpoint="/api/merchant/products"
            extraPayload={{ 
              tenant_id: tenant?.id || 'tenant_albaraka',
              branch_id: activeBranchId !== 'all' ? activeBranchId : 'br_downtown'
            }}
            onSuccess={fetchProducts}
            sampleRows={[
              { 
                name_ar: 'جبنة دومتي فيتا 500 جم', 
                name_en: 'Domty Feta Cheese 500g', 
                barcode: '6222000987654', 
                sku: 'DOM-001', 
                selling_price: 42.50, 
                cost_price: 36.00, 
                min_stock_alert: 10, 
                initial_stock: 30 
              }
            ]}
          />

          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-[#246BFD] hover:bg-[#1A54D4] transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{lang === 'ar' ? 'إضافة صنف جديد' : 'Add Product'}</span>
          </button>
        </div>
      </div>

      {/* Date Range Filter */}
      <DateRangeFilter
        startDate={startDate}
        endDate={endDate}
        onChange={(start, end) => {
          setStartDate(start);
          setEndDate(end);
        }}
      />

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

      {/* Catalog Table & Mobile Cards */}
      <div className="bg-white rounded-xl border border-[#E5EAF2] overflow-hidden shadow-2xs">
        
        {/* Mobile View: Responsive Cards (< md) */}
        <div className="md:hidden divide-y divide-[#E5EAF2]">
          {loading ? (
            <div className="p-8 text-center text-[#687386]">
              {t('loading')}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-[#687386]">
              {t('no_records')}
            </div>
          ) : (
            filtered.slice(0, visibleCount).map((p) => {
              const isLow = p.current_stock !== undefined && p.current_stock <= p.min_stock_alert;
              return (
                <div key={p.id} className="p-3.5 space-y-2.5 bg-white hover:bg-[#F8FAFC] transition-colors">
                  {/* Header: Name + Stock Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-[#0B1730] text-sm leading-snug truncate">
                        {lang === 'ar' ? p.name_ar : p.name_en}
                      </h4>
                      <p className="text-[11px] text-[#687386] truncate">
                        {lang === 'ar' ? p.name_en : p.name_ar}
                      </p>
                    </div>
                    <span className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono ${
                      isLow ? 'bg-[#FEF2F2] text-[#EF4444] border border-[#FECACA]' : 'bg-[#ECFDF5] text-[#10B981] border border-[#A7F3D0]'
                    }`}>
                      {p.current_stock ?? 0} {p.unit_name_en || 'PCS'}
                    </span>
                  </div>

                  {/* Info Tags: Category + SKU + Barcode */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="px-2 py-0.5 rounded bg-gray-100 text-[#172033] font-medium">
                      {lang === 'ar' ? p.category_name_ar : p.category_name_en}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-blue-50 text-[#246BFD] font-mono font-semibold">
                      {p.sku}
                    </span>
                    <button
                      type="button"
                      onClick={() => setBarcodeModalProduct(p)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#EEF4FF] text-[#246BFD] font-mono hover:bg-[#DCE7FE] transition-colors"
                      title={lang === 'ar' ? 'طباعة ملصق الباركود' : 'Print Barcode'}
                    >
                      <Barcode className="w-3.5 h-3.5 text-[#246BFD]" />
                      <span>{p.barcode}</span>
                    </button>
                    {p.is_weighted === 1 && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#FEF3C7] text-[#D97706]">
                        {lang === 'ar' ? 'وزن (كجم)' : 'Weight'}
                      </span>
                    )}
                  </div>

                  {/* Prices & Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-dashed border-[#E5EAF2]">
                    <div>
                      <span className="text-[10px] text-[#687386] block">
                        {lang === 'ar' ? 'سعر البيع' : 'Selling Price'}
                      </span>
                      <span className="font-black text-sm text-[#0B1730]">
                        {p.selling_price.toFixed(2)} {t('currency')}
                      </span>
                      <span className="text-[10px] text-[#687386] ms-2">
                        ({lang === 'ar' ? 'التكلفة:' : 'Cost:'} {p.cost_price.toFixed(2)})
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setBarcodeModalProduct(p)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                        title={lang === 'ar' ? 'طباعة ملصق الباركود' : 'Print Barcode Label'}
                      >
                        <Printer className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{lang === 'ar' ? 'طباعة' : 'Print'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(p)}
                        className="p-1.5 rounded-lg text-[#246BFD] hover:bg-[#EEF4FF] transition-colors border border-[#E5EAF2]"
                        title={lang === 'ar' ? 'تعديل الصنف' : 'Edit Product'}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteProduct(p)}
                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors border border-[#E5EAF2]"
                        title={lang === 'ar' ? 'حذف الصنف' : 'Delete Product'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop View: Full Table (hidden on mobile < md) */}
        <div className="hidden md:block overflow-x-auto">
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
                            onClick={() => setBarcodeModalProduct(p)}
                            title={lang === 'ar' ? 'طباعة ملصق الباركود' : 'Print Barcode Label'}
                            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
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
            <div className="sm:col-span-2">
              <label className="block font-semibold text-[#172033] mb-1">اسم المنتج / Product Name *</label>
              <input
                type="text"
                required
                value={formData.name_ar}
                onChange={(e) => setFormData({ ...formData, name_ar: e.target.value, name_en: e.target.value })}
                placeholder="حليب جهينة 1 لتر / Juhayna Milk 1L"
                className="w-full px-3 py-2 rounded-lg border border-[#E5EAF2] focus:border-[#246BFD] focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-semibold text-[#172033]">{lang === 'ar' ? 'رمز SKU' : 'SKU Code'}</label>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, sku: `SKU-${Date.now().toString().slice(-6)}` }))}
                  className="inline-flex items-center gap-1 text-[11px] text-[#246BFD] hover:underline font-bold cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>{lang === 'ar' ? 'توليد تلقائي' : 'Auto Generate'}</span>
                </button>
              </div>
              <input
                type="text"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                placeholder={`SKU-${Date.now().toString().slice(-6)}`}
                className="w-full px-3 py-2 rounded-lg border border-[#E5EAF2] font-mono focus:border-[#246BFD] focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-semibold text-[#172033]">
                  {lang === 'ar' ? 'الباركود الرئيسي *' : 'Primary Barcode *'}
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, barcode: generateRandomBarcode('622') }))}
                    className="inline-flex items-center gap-1 text-[11px] text-[#246BFD] hover:underline font-bold cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>{lang === 'ar' ? 'توليد تلقائي' : 'Auto Generate'}</span>
                  </button>
                  {formData.barcode && (
                    <button
                      type="button"
                      onClick={() => setBarcodeModalProduct({
                        id: 'temp-new',
                        name_ar: formData.name_ar || (lang === 'ar' ? 'صنف جديد' : 'New Product'),
                        name_en: formData.name_en || 'New Product',
                        barcode: formData.barcode,
                        selling_price: Number(formData.selling_price) || 0,
                        cost_price: Number(formData.cost_price) || 0,
                        sku: formData.sku || 'SKU-NEW',
                        category_id: formData.category_id,
                        unit_id: formData.unit_id,
                        tax_rate: formData.tax_rate,
                        min_stock_alert: formData.min_stock_alert,
                        is_weighted: formData.is_weighted ? 1 : 0,
                        has_batch_tracking: formData.has_batch_tracking ? 1 : 0,
                      } as Product)}
                      className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-1.5 py-0.5 rounded font-bold cursor-pointer transition-colors"
                    >
                      <Printer className="w-3 h-3 text-emerald-600" />
                      <span>{lang === 'ar' ? 'طباعة الملصق' : 'Print Label'}</span>
                    </button>
                  )}
                </div>
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
              <label className="block font-semibold text-[#172033] mb-1">
                {lang === 'ar' ? 'وحدة القياس *' : 'Unit of Measure *'}
              </label>
              <div className="space-y-1.5">
                <select
                  value={formData.unit_id}
                  onChange={(e) => setFormData({ ...formData, unit_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#E5EAF2] font-semibold focus:border-[#246BFD] focus:outline-none cursor-pointer"
                >
                  {units.map(u => (
                    <option key={u.id} value={u.id}>{lang === 'ar' ? u.name_ar : u.name_en}</option>
                  ))}
                  <option value="custom">{lang === 'ar' ? 'وحدة مخصصة (كتابة يدوية)' : 'Custom Unit'}</option>
                </select>
                <input
                  type="text"
                  value={createCustomUnit}
                  onChange={(e) => setCreateCustomUnit(e.target.value)}
                  placeholder={lang === 'ar' ? 'أو اكتب وحدتك الخاصة (مثال: كيس، متر، لتر، كرتونة، دستة، طقم، شيكارة...)' : 'Or type custom unit (e.g. Bag, Meter, Liter, Box, Pack...)'}
                  className="w-full px-3 py-1.5 rounded-lg border border-[#CBD5E1] text-xs focus:border-[#246BFD] focus:outline-none"
                />
              </div>
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

          {/* Variants Management */}
          <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-2 text-xs">
            <div>
              <span className="font-bold text-xs text-[#0B1730] block">
                {lang === 'ar' ? 'تنوعات الصنف (ألوان، مقاسات، أحجام، أوزان)' : 'Product Variants (Colors, Sizes, Options)'}
              </span>
              <span className="text-[11px] text-[#687386]">
                {lang === 'ar' ? 'عند النقر على هذا الصنف في شاشة البيع، يظهر اختيار لاختيار التنوع وسعره تلقائياً' : 'In POS, clicking this product prompts to choose a variant'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newVarName}
                onChange={(e) => setNewVarName(e.target.value)}
                placeholder={lang === 'ar' ? 'اسم التنوع (مثلاً: أحمر، كحلي، XL، مقاس 42، 1 لتر...)' : 'Variant name (e.g. Red, XL, 1L...)'}
                className="flex-1 px-3 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-xs outline-none focus:border-[#246BFD]"
              />
              <input
                type="number"
                step="0.5"
                min="0"
                value={newVarPrice}
                onChange={(e) => setNewVarPrice(e.target.value)}
                placeholder={lang === 'ar' ? `السعر (اختياري)` : 'Price (opt)'}
                className="w-28 px-3 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-xs outline-none focus:border-[#246BFD]"
              />
              <button
                type="button"
                onClick={() => {
                  if (newVarName.trim()) {
                    setCreateVariants(prev => [...prev, { name: newVarName.trim(), price: newVarPrice !== '' ? Number(newVarPrice) : undefined }]);
                    setNewVarName('');
                    setNewVarPrice('');
                  }
                }}
                className="px-3 py-1.5 bg-[#246BFD] hover:bg-[#1A54D4] text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                {lang === 'ar' ? '+ إضافة تنوع' : '+ Add Variant'}
              </button>
            </div>

            {createVariants.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {createVariants.map((v, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 text-xs font-semibold">
                    <span>{v.name}</span>
                    {v.price !== undefined && <span className="font-mono text-[10px] text-blue-600">({v.price} {currency})</span>}
                    <button
                      type="button"
                      onClick={() => setCreateVariants(prev => prev.filter((_, i) => i !== idx))}
                      className="text-blue-500 hover:text-red-500 font-bold ml-1 cursor-pointer"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
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
            <div className="sm:col-span-2">
              <label className="block font-semibold text-[#172033] mb-1">اسم المنتج / Product Name *</label>
              <input
                type="text"
                required
                value={editFormData.name_ar}
                onChange={(e) => setEditFormData({ ...editFormData, name_ar: e.target.value, name_en: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E5EAF2] focus:border-[#246BFD] focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-semibold text-[#172033]">{lang === 'ar' ? 'رمز SKU' : 'SKU Code'}</label>
                <button
                  type="button"
                  onClick={() => setEditFormData(prev => ({ ...prev, sku: `SKU-${Date.now().toString().slice(-6)}` }))}
                  className="inline-flex items-center gap-1 text-[11px] text-[#246BFD] hover:underline font-bold cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>{lang === 'ar' ? 'توليد جديد' : 'Generate'}</span>
                </button>
              </div>
              <input
                type="text"
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
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEditFormData(prev => ({ ...prev, barcode: generateRandomBarcode('622') }))}
                    className="inline-flex items-center gap-1 text-[11px] text-[#246BFD] hover:underline font-bold cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>{lang === 'ar' ? 'توليد جديد' : 'Generate'}</span>
                  </button>
                  {editFormData.barcode && (
                    <button
                      type="button"
                      onClick={() => setBarcodeModalProduct({
                        id: editingProductId || 'temp-edit',
                        name_ar: editFormData.name_ar,
                        name_en: editFormData.name_en,
                        barcode: editFormData.barcode,
                        selling_price: Number(editFormData.selling_price) || 0,
                        cost_price: Number(editFormData.cost_price) || 0,
                        sku: editFormData.sku,
                        category_id: editFormData.category_id,
                        unit_id: editFormData.unit_id,
                        tax_rate: editFormData.tax_rate,
                        min_stock_alert: editFormData.min_stock_alert,
                        is_weighted: editFormData.is_weighted ? 1 : 0,
                        has_batch_tracking: editFormData.has_batch_tracking ? 1 : 0,
                      } as Product)}
                      className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-1.5 py-0.5 rounded font-bold cursor-pointer transition-colors"
                    >
                      <Printer className="w-3 h-3 text-emerald-600" />
                      <span>{lang === 'ar' ? 'طباعة الملصق' : 'Print Label'}</span>
                    </button>
                  )}
                </div>
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
              <div className="space-y-1.5">
                <select
                  value={editFormData.unit_id}
                  onChange={(e) => setEditFormData({ ...editFormData, unit_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#E5EAF2] font-semibold focus:border-[#246BFD] focus:outline-none cursor-pointer"
                >
                  {units.map(u => (
                    <option key={u.id} value={u.id}>{lang === 'ar' ? u.name_ar : u.name_en}</option>
                  ))}
                  <option value="custom">{lang === 'ar' ? 'وحدة مخصصة (كتابة يدوية)' : 'Custom Unit'}</option>
                </select>
                <input
                  type="text"
                  value={editCustomUnit}
                  onChange={(e) => setEditCustomUnit(e.target.value)}
                  placeholder={lang === 'ar' ? 'أو اكتب وحدتك الخاصة (مثال: كيس، متر، لتر، كرتونة، دستة، طقم، شيكارة...)' : 'Or type custom unit (e.g. Bag, Meter, Liter, Box, Pack...)'}
                  className="w-full px-3 py-1.5 rounded-lg border border-[#CBD5E1] text-xs focus:border-[#246BFD] focus:outline-none"
                />
              </div>
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

          {/* Variants Management */}
          <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-2 text-xs">
            <div>
              <span className="font-bold text-xs text-[#0B1730] block">
                {lang === 'ar' ? 'تنوعات الصنف (ألوان، مقاسات، أحجام، أوزان)' : 'Product Variants (Colors, Sizes, Options)'}
              </span>
              <span className="text-[11px] text-[#687386]">
                {lang === 'ar' ? 'عند النقر على هذا الصنف في شاشة البيع، يظهر اختيار لاختيار التنوع وسعره تلقائياً' : 'In POS, clicking this product prompts to choose a variant'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editNewVarName}
                onChange={(e) => setEditNewVarName(e.target.value)}
                placeholder={lang === 'ar' ? 'اسم التنوع (مثلاً: أحمر، كحلي، XL، مقاس 42، 1 لتر...)' : 'Variant name (e.g. Red, XL, 1L...)'}
                className="flex-1 px-3 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-xs outline-none focus:border-[#246BFD]"
              />
              <input
                type="number"
                step="0.5"
                min="0"
                value={editNewVarPrice}
                onChange={(e) => setEditNewVarPrice(e.target.value)}
                placeholder={lang === 'ar' ? `السعر (اختياري)` : 'Price (opt)'}
                className="w-28 px-3 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-xs outline-none focus:border-[#246BFD]"
              />
              <button
                type="button"
                onClick={() => {
                  if (editNewVarName.trim()) {
                    setEditVariants(prev => [...prev, { name: editNewVarName.trim(), price: editNewVarPrice !== '' ? Number(editNewVarPrice) : undefined }]);
                    setEditNewVarName('');
                    setEditNewVarPrice('');
                  }
                }}
                className="px-3 py-1.5 bg-[#246BFD] hover:bg-[#1A54D4] text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                {lang === 'ar' ? '+ إضافة تنوع' : '+ Add Variant'}
              </button>
            </div>

            {editVariants.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {editVariants.map((v, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 text-xs font-semibold">
                    <span>{v.name}</span>
                    {v.price !== undefined && <span className="font-mono text-[10px] text-blue-600">({v.price} {currency})</span>}
                    <button
                      type="button"
                      onClick={() => setEditVariants(prev => prev.filter((_, i) => i !== idx))}
                      className="text-blue-500 hover:text-red-500 font-bold ml-1 cursor-pointer"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
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

      {/* Bulk Excel & CSV Import Modal */}
      <Modal
        isOpen={isImportOpen}
        onClose={() => {
          setIsImportOpen(false);
          setImportResult(null);
          setExcelPreviewRows([]);
          setExcelFileName('');
        }}
        title={lang === 'ar' ? 'استيراد أصناف من ملف إكسيل (Excel / CSV)' : 'Bulk Product Import (Excel / CSV)'}
        maxWidth="xl"
      >
        <div className="space-y-4 text-xs">
          {/* File Upload Box */}
          <div className="p-4 border-2 border-dashed border-[#CBD5E1] hover:border-[#246BFD] rounded-xl text-center space-y-2 bg-[#F8FAFC] transition-colors">
            <Upload className="w-8 h-8 text-[#246BFD] mx-auto opacity-80" />
            <div>
              <p className="font-bold text-sm text-[#0B1730]">
                {lang === 'ar' ? 'اختر أو اسحب ملف Excel (.xlsx / .xls) أو CSV هنا' : 'Upload Excel (.xlsx / .xls) or CSV file'}
              </p>
              <p className="text-[11px] text-[#687386] mt-0.5">
                {lang === 'ar' ? 'يدعم قراءة ملفات إكسيل مباشرة واستخراج الأصناف والأسعار تلقائياً' : 'Parses products, prices, and barcodes directly from Excel'}
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-1">
              <label className="px-4 py-2 bg-[#246BFD] hover:bg-[#1A54D4] text-white rounded-lg font-bold cursor-pointer transition-colors shadow-xs">
                <span>{lang === 'ar' ? 'تصفح الملفات' : 'Browse File'}</span>
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleExcelUpload}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={() => {
                  const sampleCsv = `sku,barcode,name_ar,name_en,cost_price,selling_price,min_stock,initial_stock\nSKU-1001,622115501001,جبنة بيضاء 500 جم,Feta Cheese 500g,25,32,10,50\nSKU-1002,622115501002,حليب كامل الدسم 1 لتر,Full Cream Milk 1L,35,42,15,60`;
                  const blob = new Blob([sampleCsv], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'sastmhaly_products_template.csv';
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="px-3 py-2 border border-[#CBD5E1] bg-white hover:bg-gray-50 text-[#172033] rounded-lg font-bold flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'تحميل نموذج تجريبي (Template)' : 'Download Template'}</span>
              </button>
            </div>
            {excelFileName && (
              <p className="text-xs font-semibold text-emerald-700 bg-emerald-50 py-1 px-3 rounded inline-block mt-2">
                ✓ تم اختيار الملف: <span className="font-mono">{excelFileName}</span> ({excelPreviewRows.length} صنف تم قراءته)
              </p>
            )}
          </div>

          {/* Preview Table of Excel Rows */}
          {excelPreviewRows.length > 0 && (
            <div className="border border-[#E5EAF2] rounded-xl overflow-hidden space-y-2 p-3 bg-white">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#0B1730]">
                  {lang === 'ar' ? `معاينة البيانات المستخرجة (${excelPreviewRows.length} صنف)` : `Parsed Products (${excelPreviewRows.length})`}
                </span>
                <button
                  type="button"
                  onClick={handleExecuteExcelImport}
                  disabled={importingExcel}
                  className="px-4 py-1.5 bg-[#10B981] hover:bg-[#059669] text-white rounded-lg font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {importingExcel ? (lang === 'ar' ? 'جاري الاستيراد...' : 'Importing...') : (lang === 'ar' ? `تأكيد استيراد ${excelPreviewRows.length} صنف ⚡` : 'Confirm Import')}
                </button>
              </div>

              <div className="max-h-48 overflow-y-auto border border-gray-100 rounded-lg">
                <table className="w-full text-right text-[11px] border-collapse">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-700">
                    <tr>
                      <th className="p-2">#</th>
                      <th className="p-2">الاسم عربي</th>
                      <th className="p-2">الاسم إنجليزي</th>
                      <th className="p-2">الباركود</th>
                      <th className="p-2 text-left">التكلفة</th>
                      <th className="p-2 text-left">سعر البيع</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {excelPreviewRows.slice(0, 10).map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="p-2 text-gray-400">{i + 1}</td>
                        <td className="p-2 font-semibold text-gray-900">{row.name_ar}</td>
                        <td className="p-2 text-gray-600">{row.name_en}</td>
                        <td className="p-2 font-mono text-gray-700">{row.barcode}</td>
                        <td className="p-2 text-left font-mono">{row.cost_price}</td>
                        <td className="p-2 text-left font-bold font-mono text-blue-600">{row.selling_price}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {excelPreviewRows.length > 10 && (
                <p className="text-[10px] text-gray-500 text-center">
                  عرض أول 10 أصناف من أصل {excelPreviewRows.length} صنف جاهز للاستيراد
                </p>
              )}
            </div>
          )}

          {/* Manual CSV Textarea Option */}
          <details className="text-gray-600">
            <summary className="cursor-pointer font-bold text-xs text-[#246BFD] hover:underline mb-2">
              {lang === 'ar' ? 'أو لصق سطور CSV يدوياً (خيارات متقدمة)' : 'Or paste raw CSV text'}
            </summary>
            <textarea
              rows={5}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="sku,barcode,name_en,name_ar,cost_price,selling_price,min_stock"
              className="w-full p-2.5 rounded-lg border border-[#CBD5E1] font-mono text-xs focus:border-[#246BFD] focus:outline-none"
            />
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={handleBulkImport}
                className="px-3 py-1.5 bg-[#246BFD] hover:bg-[#1A54D4] text-white rounded-lg font-bold text-xs"
              >
                {lang === 'ar' ? 'استيراد النص الملصوق' : 'Import Pasted CSV'}
              </button>
            </div>
          </details>

          {importResult && (
            <div className={`p-3 rounded-lg ${importResult.errorCount === 0 ? 'bg-[#ECFDF5] text-[#10B981]' : 'bg-[#FFFBEB] text-[#B45309]'}`}>
              <p className="font-bold">
                ✓ {lang === 'ar' ? `تم استيراد ${importResult.successCount} صنف بنجاح!` : `Successfully imported ${importResult.successCount} items!`}
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

          <div className="pt-2 flex justify-end gap-2 border-t border-[#E5EAF2]">
            <button
              type="button"
              onClick={() => {
                setIsImportOpen(false);
                setExcelPreviewRows([]);
                setExcelFileName('');
              }}
              className="px-4 py-2 rounded-lg border border-[#E5EAF2] font-bold text-[#687386]"
            >
              {t('cancel')}
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

      {/* Barcode Sticker Print Modal */}
      {barcodeModalProduct && (
        <BarcodePrintModal
          isOpen={!!barcodeModalProduct}
          onClose={() => setBarcodeModalProduct(null)}
          product={barcodeModalProduct}
          tenantName={tenant?.name}
          currency={t('currency')}
        />
      )}

    </div>
  );
}
