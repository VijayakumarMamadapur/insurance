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

  function PoliciesViewModel() {
    const self = this;

    // ---------------- Observables ----------------
    self.policies = ko.observableArray([]);
    self.customers = ko.observableArray([]);
    self.filterCustomerId = ko.observable();
    self.selectedRow = ko.observable(); 
    self.selectedPolicy = ko.observable();

    // ---------------- Data Providers ----------------
    self.policiesDP = new ArrayDataProvider(self.policies, { keyAttributes: "id" });
    self.customersDP = new ArrayDataProvider(self.customers, { keyAttributes: "id" });

    // ---------------- Messages ----------------
    self.messages = ko.observableArray([]);
    self.showMessage = (severity, detail) => {
      self.messages.push({
        severity,
        summary: severity.toUpperCase(),
        detail,
        autoTimeout: 3500
      });
    };
    
    // ---------------- Load Customers ----------------
    self.loadCustomers = () => {
      return api.customers.getAll()
        .then(data => {
          const mapped = (data || []).map(c => ({
            ...c,
            fullName: (c.firstName || "") + " " + (c.lastName || "")
          }));
          self.customers(mapped);
          return mapped;
        })
        .catch(err => {
          self.showMessage("error", "Failed to load customers");
          throw err;
        });
    };

    // ---------------- Load Policies ----------------
    self.loadPolicies = () => {
      return api.policies.getAll(self.filterCustomerId())
        .then(data => {
          const mapped = (data || []).map(p => ({
            ...p,
            customer: { ...p.customer, fullName: (p.customer.firstName || "") + " " + (p.customer.lastName || "") },
            product: { ...p.product }
          }));
          self.policies(mapped);
          return mapped;
        })
        .catch(err => {
          self.showMessage("error", "Failed to load policies: " + (err.message || err));
          throw err;
        });
    };

    // ---------------- Row Selection -> Open Dialog ----------------
    self.selectedRow.subscribe(function (row) {
      if (row && row.data) {
        let rowData = row.data;
        rowData.customer = rowData.customer || { fullName: "" };
        rowData.product = rowData.product || { name: "" };
        self.selectedPolicy(rowData);

        const dialog = document.querySelector('#viewPolicyDialog');
        if (dialog) dialog.open();
      }
    });

    // Row change handler
self.handleRowChanged = (event) => {
  const rowContext = event.detail.value; // { rowKey, rowIndex }
  if (rowContext && rowContext.rowKey != null) {
    // find policy by key
    const selected = self.policies().find(p => p.id === rowContext.rowKey);
    if (selected) {
      selected.customer = selected.customer || { fullName: "" };
      selected.product = selected.product || { name: "" };
      self.selectedPolicy(selected);

      const dialog = document.querySelector("#viewPolicyDialog");
      if (dialog) dialog.open();
    }
  }
};


    // ---------------- Close Dialog ----------------
    self.closeDialog = () => {
      const dialog = document.querySelector('#viewPolicyDialog');
      if (dialog) dialog.close();
      self.selectedPolicy(null);
    };

    // ---------------- Init ----------------
    Promise.all([self.loadCustomers(), self.loadPolicies()])
      .catch(() => { /* errors reported via showMessage */ });
  }

  return PoliciesViewModel;
});
