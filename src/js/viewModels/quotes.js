define([
  "knockout",
  "ojs/ojarraydataprovider",
  "services/apiService",
  "ojs/ojmessages",
  "ojs/ojbutton",
  "ojs/ojformlayout",
  "ojs/ojinputtext",
  "ojs/ojselectsingle",
  "ojs/ojtable",
  "ojs/ojdialog"
], function (ko, ArrayDataProvider, api) {

  function QuotesViewModel() {
    const self = this;

    // ---------------- Observables ----------------
    self.quotes = ko.observableArray([]);
    self.customers = ko.observableArray([]);
    self.products = ko.observableArray([]);
    self.messages = ko.observableArray([]);

    self.selectedRow = ko.observable(null);

    self.filterCustomerId = ko.observable();
    self.filterStatus = ko.observable();

    self.newQuote = {
      customerId: ko.observable(null),
      productId: ko.observable(null),
      sumAssured: ko.observable(''),
      termMonths: ko.observable('')
    };


    self.editQuote = ko.observable({
      id: null,
      customerId: null,
      productId: null,
      sumAssured: '',
      termMonths: '',
      status: ''
    });
    self.createQuote = () => {
  const body = {
    customerId: self.newQuote.customerId(),
    productId: self.newQuote.productId(),
    sumAssured: parseInt(self.newQuote.sumAssured() || 0, 10),
    termMonths: parseInt(self.newQuote.termMonths() || 0, 10),
    status: "DRAFT"
  };

  api.quotes.create(body)
    .then(() => self.loadQuotes())
    .then(() => {
      const dlg = document.getElementById("createQuoteDialog");
      if (dlg) dlg.close();
      self.showMessage("confirmation", "Quote created successfully");
      // reset newQuote fields
      self.newQuote.customerId(null);
      self.newQuote.productId(null);
      self.newQuote.sumAssured('');
      self.newQuote.termMonths('');
    })
    .catch(err => {
      self.showMessage("error", "Failed to create quote: " + (err.message || err));
    });
};


    self.statuses = [
      { value: "DRAFT", label: "Draft" },
      { value: "PRICED", label: "Priced" },
      { value: "CONFIRMED", label: "Confirmed" }
    ];

    // ---------------- Data Providers ----------------
    self.quotesDP = new ArrayDataProvider(self.quotes, { keyAttributes: "id" });
    self.customersDP = new ArrayDataProvider(self.customers, { keyAttributes: "id" });
    self.productsDP = new ArrayDataProvider(self.products, { keyAttributes: "id" });
    self.statusDP = new ArrayDataProvider(self.statuses, { keyAttributes: "value" });

    // ---------------- Message Helper ----------------
    self.showMessage = (severity, detail) => {
      self.messages.push({
        severity,
        summary: severity.toUpperCase(),
        detail,
        autoTimeout: 3500
      });
    };

    // ---------------- Selected Quote Helper ----------------
    self.selectedQuote = ko.pureComputed(() => {
      const row = self.selectedRow();
      if (!row || !row.rowKey) return null;
      return self.quotes().find(q => q.id === row.rowKey) || null;
    });

    self.selectedRow.subscribe(row => {
      if (row && row.rowKey) {
        const quote = self.quotes().find(q => q.id === row.rowKey);
        if (quote) {
          self.editQuote({
            id: quote.id,
            customerId: quote.customer.id,
            productId: quote.product.id,
            sumAssured: quote.sumAssured,
            termMonths: quote.termMonths,
            status: quote.status
          });
          const dlg = document.getElementById("updateQuoteDialog");
          if (dlg) dlg.open();
        }
      }
    });

    // ---------------- Load Data ----------------
    self.loadQuotes = (customerId, status) => {
      return api.quotes.getAll(customerId || null, status || null)
        .then(data => {
          const mapped = (data || []).map(q => ({
            ...q,
            customer: { ...q.customer, fullName: (q.customer.firstName || "") + " " + (q.customer.lastName || ""), id: q.customer.id },
            product: { ...q.product, name: q.product.name || "", id: q.product.id },
            premiumCached: q.premiumCached != null ? q.premiumCached : q.premium || null,
            selected: ko.observable(false)
          }));
          self.quotes(mapped);
          return mapped;
        })
        .catch(err => {
          self.showMessage("error", "Failed to load quotes: " + (err.message || err));
        });
    };

    self.loadCustomers = () => {
      return api.customers.getAll()
        .then(data => {
          const mapped = (data || []).map(c => ({
            ...c,
            fullName: (c.firstName || "") + " " + (c.lastName || ""),
            id: c.id
          }));
          self.customers(mapped);
        });
    };

    self.loadProducts = () => {
      return api.products.getAll(true)
        .then(data => self.products(data || []));
    };

    // ---------------- Filter Action ----------------
    self.applyFilter = () => {
      if (self.filterCustomerId()) {
        self.loadQuotes(self.filterCustomerId(), null);
      } else if (self.filterStatus()) {
        self.loadQuotes(null, self.filterStatus());
      } else {
        self.loadQuotes();
      }
    };

    // ---------------- Row Actions ----------------
    self.getCheckedRows = () => self.quotes().filter(q => q.selected());

    self.priceCheckedRows = () => {
      const rows = self.getCheckedRows();
      if (!rows.length) { self.showMessage("error", "Select at least one quote"); return; }
      rows.forEach(row => self.priceRow(row));
    };

    self.confirmCheckedRows = async () => {
      const rows = self.getCheckedRows();
      if (!rows.length) { self.showMessage("error", "Select at least one quote"); return; }
      for (let row of rows) await self.confirmRow(row);
    };

    self.priceRow = async (quote) => {
      if (!quote || !quote.id) return self.showMessage("error", "Invalid quote for pricing");
      try {
        await api.quotes.price(quote.id);
        await self.loadQuotes();
        self.showMessage("confirmation", `Quote priced`);
      } catch (err) {
        self.showMessage("error", "Failed to price quote: " + (err.message || err));
      }
    };

    self.confirmRow = async (quote) => {
      if (!quote || !quote.id) return self.showMessage("error", "Invalid quote for confirmation");
      try {
        await api.quotes.confirm(quote.id);
        await self.loadQuotes();
        self.showMessage("confirmation", `Quote confirmed`);
      } catch (err) {
        self.showMessage("error", "Failed to confirm quote: " + (err.message || err));
      }
    };

    self.deleteSelected = () => {
      const q = self.selectedQuote();
      if (!q) return self.showMessage("error", "Please select a quote to delete");
      if (!confirm("Are you sure you want to delete this quote?")) return;
      if (api.quotes.remove) {
        api.quotes.remove(q.id)
          .then(() => self.loadQuotes())
          .then(() => self.showMessage("confirmation", "Quote deleted"))
          .catch(err => self.showMessage("error", "Failed to delete quote: " + (err.message || err)));
      } else {
        self.showMessage("error", "Delete API not implemented");
      }
    };

    // ---------------- Init ----------------
    Promise.all([self.loadCustomers(), self.loadProducts(), self.loadQuotes()]);
  }

  return QuotesViewModel;
});
