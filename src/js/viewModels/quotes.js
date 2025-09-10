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

    // simple nested objects (kept for backward compatibility)
    self.newQuote = ko.observable({
      customerId: null,
      productId: null,
      sumAssured: '',
      termMonths: ''
    });

    self.editQuote = ko.observable({
      id: null,
      customerId: null,
      productId: null,
      sumAssured: '',
      termMonths: '',
      status: ''
    });

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
      // severity: "confirmation", "error", "warning", "info"
      self.messages.push({
        severity,
        summary: severity.toUpperCase(),
        detail,
        autoTimeout: 3500
      });
    };

    // ---------------- Selected Quote helper ----------------
    self.selectedQuote = ko.pureComputed(() => {
      const row = self.selectedRow();
      if (!row || !row.rowKey) return null;
      return self.quotes().find(q => q.id === row.rowKey) || null;
    });

    // ---------------- Row Selection for Edit Dialog ----------------
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
    // IMPORTANT: return the Promise so callers can await it
    self.loadQuotes = () => {
      return api.quotes.getAll(self.filterCustomerId(), self.filterStatus())
        .then(data => {
          const mapped = (data || []).map(q => {
            const customer = q.customer || {};
            const product = q.product || {};
            return {
              ...q,
              customer: {
                ...customer,
                fullName: (customer.firstName || "") + (customer.lastName ? (" " + customer.lastName) : ""),
                id: customer.id
              },
              product: {
                ...product,
                name: product.name || "",
                id: product.id
              },
              // keep exact backend field name "premiumCached"
              premiumCached: q.premiumCached != null ? q.premiumCached : (q.premium != null ? q.premium : null),
              pricingSource: q.pricingSource || null
            };
          });
          self.quotes(mapped);
          return mapped;
        })
        .catch(err => {
          const msg = (err && err.message) ? err.message : err;
          self.showMessage("error", "Failed to load quotes: " + msg);
          // rethrow so await callers can catch
          throw err;
        });
    };

    self.loadCustomers = () => {
      return api.customers.getAll()
        .then(data => {
          const mapped = (data || []).map(c => ({
            ...c,
            fullName: (c.firstName || "") + (c.lastName ? (" " + c.lastName) : ""),
            id: c.id
          }));
          self.customers(mapped);
          return mapped;
        })
        .catch(err => {
          self.showMessage("error", "Failed to load customers");
          throw err;
        });
    };

    self.loadProducts = () => {
      return api.products.getAll(true)
        .then(data => {
          self.products(data || []);
          return data || [];
        })
        .catch(err => {
          self.showMessage("error", "Failed to load products");
          throw err;
        });
    };

    // ---------------- Actions ----------------
    self.createQuote = () => {
      const q = self.newQuote();
      const body = {
        customerId: q.customerId,
        productId: q.productId,
        sumAssured: parseInt(q.sumAssured || 0, 10),
        termMonths: parseInt(q.termMonths || 0, 10),
        status: "DRAFT"
      };
      api.quotes.create(body)
        .then(() => {
          return self.loadQuotes();
        })
        .then(() => {
          const dlg = document.getElementById("createQuoteDialog");
          if (dlg) dlg.close();
          self.showMessage("confirmation", "Quote created successfully");
          self.newQuote({
            customerId: null,
            productId: null,
            sumAssured: '',
            termMonths: ''
          });
        })
        .catch(err => {
          const msg = (err && err.message) ? err.message : err;
          self.showMessage("error", "Failed to create quote: " + msg);
        });
    };

    self.saveUpdatedQuote = () => {
      const q = self.editQuote();
      const body = {
        customerId: q.customerId,
        productId: q.productId,
        sumAssured: parseInt(q.sumAssured || 0, 10),
        termMonths: parseInt(q.termMonths || 0, 10),
        status: q.status
      };
      api.quotes.update(q.id, body)
        .then(() => self.loadQuotes())
        .then(() => {
          const dlg = document.getElementById("updateQuoteDialog");
          if (dlg) dlg.close();
          self.showMessage("confirmation", "Quote updated successfully");
        })
        .catch(err => {
          const msg = (err && err.message) ? err.message : err;
          self.showMessage("error", "Failed to update quote: " + msg);
        });
    };

    // Price a specific quote object (per-row)
    self.priceRow = async (quote) => {
      if (!quote || !quote.id) {
        self.showMessage("error", "Invalid quote for pricing");
        return;
      }
      try {
        const res = await api.quotes.price(quote.id);
        // wait for list refresh so UI shows updated premium
        await self.loadQuotes();
        const fresh = self.quotes().find(x => x.id === quote.id) || {};
        // try to read premium from response first, otherwise from fresh list
        const premium = (res && (res.premiumCached != null ? res.premiumCached : res.premium)) || fresh.premiumCached || null;
        if (premium != null) {
          self.showMessage("confirmation", `Quote priced — premium: ${premium}`);
        } else {
          self.showMessage("confirmation", `Quote priced`);
        }
      } catch (err) {
        const msg = (err && err.message) ? err.message : err;
        self.showMessage("error", "Failed to price quote: " + msg);
      }
    };

    // Price selected row (button above table)
    self.priceSelected = () => {
      const q = self.selectedQuote();
      if (!q) {
        self.showMessage("error", "Please select a quote to price");
        return;
      }
      self.priceRow(q);
    };

    // Confirm a specific row (per-row)
    self.confirmRow = async (quote) => {
      if (!quote || !quote.id) {
        self.showMessage("error", "Invalid quote for confirmation");
        return;
      }
      try {
        // ensure we have premiumCached
        // refresh the quote from server to be safe
        await self.loadQuotes();
        const fresh = self.quotes().find(x => x.id === quote.id) || quote;

        if (fresh.premiumCached == null) {
          // price automatically
          self.showMessage("info", "Pricing quote before confirmation...");
          await api.quotes.price(fresh.id);
          await self.loadQuotes();
        }

        const after = self.quotes().find(x => x.id === quote.id);
        if (!after || after.premiumCached == null) {
          self.showMessage("error", "Premium not available. Cannot confirm quote.");
          return;
        }

        // now confirm
        const res = await api.quotes.confirm(after.id);
        // try to extract policy id from response
        let policyId = null;
        if (res) {
          policyId = res.id || res.policyId || (res.policy && res.policy.id) || null;
        }

        await self.loadQuotes();

        if (policyId) {
          self.showMessage("confirmation", `Quote confirmed — policy created (id: ${policyId})`);
        } else {
          self.showMessage("confirmation", `Quote confirmed — policy created`);
        }
      } catch (err) {
        const msg = (err && err.message) ? err.message : err;
        self.showMessage("error", "Failed to confirm quote: " + msg);
      }
    };

    // Confirm selected row (button above table)
    self.confirmSelected = async () => {
      const q = self.selectedQuote();
      if (!q) {
        self.showMessage("error", "Please select a quote to confirm");
        return;
      }
      await self.confirmRow(q);
    };

    // Optional: delete selected
    self.deleteSelected = () => {
      const q = self.selectedQuote();
      if (!q) {
        self.showMessage("error", "Please select a quote to delete");
        return;
      }
      if (!confirm("Are you sure you want to delete this quote?")) return;
      if (api.quotes.remove) {
        api.quotes.remove(q.id)
          .then(() => self.loadQuotes())
          .then(() => self.showMessage("confirmation", "Quote deleted"))
          .catch(err => {
            const msg = (err && err.message) ? err.message : err;
            self.showMessage("error", "Failed to delete quote: " + msg);
          });
      } else {
        self.showMessage("error", "Delete API not implemented");
      }
    };

    // ---------------- Init ----------------
    // chain the loads so UI fills predictably
    Promise.all([self.loadCustomers(), self.loadProducts(), self.loadQuotes()])
      .catch(() => { /* errors already reported via showMessage */ });

  }

  return QuotesViewModel;
});
