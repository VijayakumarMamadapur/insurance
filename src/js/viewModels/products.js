define([
  'knockout',
  'ojs/ojarraydataprovider',
  'ojs/ojpagingdataproviderview',
  'services/apiService',
  'ojs/ojknockout',
  'ojs/ojtable',
  'ojs/ojbutton',
  'ojs/ojdialog',
  'ojs/ojformlayout',
  'ojs/ojinputtext',
  'ojs/ojinputnumber',
  'ojs/ojpagingcontrol',
  'ojs/ojinputsearch',
  'ojs/ojswitch'
], function (ko, ArrayDataProvider, PagingDataProviderView, apiService) {
  function ProductsViewModel() {
    const self = this;

    self.products = ko.observableArray([]);
    self.allProducts = [];
    self.searchQuery = ko.observable('');
    self.selectedProduct = ko.observable();

    // Toggle for active products only (must be boolean)
    self.showActiveOnly = ko.observable(true);

    self.productDataProvider = new PagingDataProviderView(
      new ArrayDataProvider(self.products, { keyAttributes: 'id' })
    );

    self.dialogProduct = ko.observable({
      id: null,
      name: '',
      code: '',
      description: '',
      baseRatePer1000: 0,
      minSumAssured: 0,
      maxSumAssured: 0,
      minTermMonths: 0,
      maxTermMonths: 0,
      active: true
    });

    self.isAddMode = ko.observable(false);
    self.isEditMode = ko.pureComputed(() => !self.isAddMode());

    // Load products from backend, honoring activeToggle
    self.loadProducts = async function (activeOnly) {
      try {
        const useActiveOnly = typeof activeOnly === "boolean" ? activeOnly : !!self.showActiveOnly();
        const data = await apiService.products.getAll(useActiveOnly);

        // Sanitize: always boolean for 'active'
        const sanitized = data.map(p => ({
          id: p.id,
          name: p.name || "",
          code: p.code || "",
          description: p.description || "",
          baseRatePer1000: Number(p.baseRatePer1000) || 0,
          minSumAssured: Number(p.minSumAssured) || 0,
          maxSumAssured: Number(p.maxSumAssured) || 0,
          minTermMonths: Number(p.minTermMonths) || 0,
          maxTermMonths: Number(p.maxTermMonths) || 0,
          active: (p.active === true || p.active === "true" || p.active === 1)
        }));

        self.products(sanitized);
        self.allProducts = sanitized;
      } catch (e) {
        console.error("Error loading products", e);
      }
    };

    // Only subscribe in JS, not in HTML!
    self.showActiveOnly.subscribe(() => self.loadProducts());

    // Search products
    self.applySearch = () => {
      const query = self.searchQuery().toLowerCase();
      if (!query) {
        self.products(self.allProducts);
        return;
      }
      const filtered = self.allProducts.filter(p =>
        (p.name + ' ' + p.code).toLowerCase().includes(query)
      );
      self.products(filtered);
    };

    // Add product dialog
    self.addProduct = function () {
      self.isAddMode(true);
      self.dialogProduct({
        id: null,
        name: '',
        code: '',
        description: '',
        baseRatePer1000: 0,
        minSumAssured: 0,
        maxSumAssured: 0,
        minTermMonths: 0,
        maxTermMonths: 0,
        active: true
      });
      document.getElementById('productDialog').open();
    };

    // Edit dialog on row select
    self.selectedProduct.subscribe(row => {
      if (row && row.rowKey) {
        const prod = self.products().find(p => p.id === row.rowKey);
        if (prod) {
          self.isAddMode(false);
          self.dialogProduct({ ...prod }); // active already boolean
          document.getElementById('productDialog').open();
        }
      }
    });

    // Save (create/update)
    self.saveProduct = async function () {
      const prod = self.dialogProduct();
      try {
        if (self.isAddMode()) {
          await apiService.products.create(prod);
        } else {
          await apiService.products.update(prod.id, prod);
        }
            self.selectedProduct(null);   // <--- reset selection
        await self.loadProducts();
      } catch (err) {
        console.error('Error saving product:', err);
      }
      self.closeDialog();
    };

    // Delete
    self.deleteProduct = async function () {
      const prod = self.dialogProduct();
      if (!prod || !prod.id) return;
      try {
        await apiService.products.remove(prod.id);
        // self.products.remove(p => p.id === prod.id);
      } catch (err) {
        console.error('Error deleting product:', err);
      }
      self.selectedProduct(null);
      self.closeDialog();
    };

    // Close dialog
    self.closeDialog = function () {
      document.getElementById('productDialog').close();
      self.selectedProduct(null);
    };

    // Export CSV
    self.exportCSV = function () {
      const rows = self.products();
      if (!rows.length) return;
      const header = [
        'ID',
        'Name',
        'Code',
        'Description',
        'BaseRatePer1000',
        'MinSumAssured',
        'MaxSumAssured',
        'MinTermMonths',
        'MaxTermMonths',
        'Active'
      ];
      const csvContent = [
        header.join(','),
        ...rows.map(r =>
          [
            r.id,
            r.name,
            r.code,
            r.description,
            r.baseRatePer1000,
            r.minSumAssured,
            r.maxSumAssured,
            r.minTermMonths,
            r.maxTermMonths,
            r.active ? "Yes" : "No"
          ].map(v => `"${v || ''}"`).join(',')
        )
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.setAttribute('download', 'products.csv');
      a.click();
      URL.revokeObjectURL(url);
    };

    self.connected = () => self.loadProducts();
  }

  return ProductsViewModel;
});
