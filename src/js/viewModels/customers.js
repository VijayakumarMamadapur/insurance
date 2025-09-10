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
  'ojs/ojdatetimepicker',
  'ojs/ojpagingcontrol',
  'ojs/ojinputsearch'
], function (ko, ArrayDataProvider, PagingDataProviderView, apiService) {
  function CustomersViewModel() {
    const self = this;

    self.customers = ko.observableArray([]);
    self.allCustomers = [];
    self.searchQuery = ko.observable('');
    self.selectedCustomer = ko.observable();

    self.customerDataProvider = new PagingDataProviderView(
      new ArrayDataProvider(self.customers, { keyAttributes: 'id' })
    );

    self.dialogCustomer = ko.observable({
      id: null,
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      dob: ''
    });

    self.isAddMode = ko.observable(false);
    self.isEditMode = ko.pureComputed(() => !self.isAddMode());

    // Load customers from backend
    self.loadCustomers = async function () {
      try {
        self.selectedCustomer(null); // Clear before reloading data to avoid dialog reopening

        const data = await apiService.customers.getAll();
        const sanitized = data.map(c => ({
          id: c.id,
          firstName: c.firstName || '',
          lastName: c.lastName || '',
          email: c.email || '',
          phone: c.phone || '',
          dob: c.dob || ''
        }));
        self.customers(sanitized);
        self.allCustomers = sanitized;
      } catch (e) {
        console.error('Error loading customers', e);
      }
    };

    // Search
    self.applySearch = () => {
      const query = self.searchQuery().toLowerCase();
      if (!query) {
        self.customers(self.allCustomers);
        return;
      }
      const filtered = self.allCustomers.filter(c =>
        (c.firstName + ' ' + c.lastName).toLowerCase().includes(query) 
      );
      self.customers(filtered);
    };

    // Add new customer dialog
    self.addCustomer = function () {
      self.isAddMode(true);
      self.dialogCustomer({
        id: null,
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        dob: ''
      });
      document.getElementById("customerDialog").open();
    };

    // Open edit dialog on row select
    self.selectedCustomer.subscribe(row => {
      if (row && row.rowKey) {
        const cust = self.customers().find(c => c.id === row.rowKey);
        if (cust) {
          self.isAddMode(false);
          self.dialogCustomer({ ...cust });
          document.getElementById('customerDialog').open();
        }
      }
    });

    // Save new or update existing customer
    self.saveCustomer = async function () {
      const cust = self.dialogCustomer();

      try {
        if (self.isAddMode()) {
          await apiService.customers.create(cust);
        } else {
          await apiService.customers.update(cust.id, cust);
        }
        await self.loadCustomers(); // Reload for persistence
      } catch (err) {
        console.error('Error saving customer:', err);
      }

      self.closeDialog();
    };

    // Delete customer
    self.deleteCustomer = async function () {
      const cust = self.dialogCustomer();
      if (!cust || !cust.id) return;

      try {
            // self.customers.remove(c => c.id === cust.id);

        await apiService.customers.remove(cust.id);
      } catch (err) {
        console.error('Error deleting customer:', err);
      }

      self.selectedCustomer(null);
      self.closeDialog();
    };

    // Close dialog and clear selection
    self.closeDialog = function () {
      document.getElementById('customerDialog').close();
      self.selectedCustomer(null);
    };

    // Export CSV function (unchanged)
    self.exportCSV = function () {
      const rows = self.customers();
      if (!rows.length) return;

      const header = ['ID', 'First Name', 'Last Name', 'Email', 'Phone', 'DOB'];
      const csvContent = [
        header.join(','),
        ...rows.map(r => [
          r.id, r.firstName, r.lastName, r.email, r.phone, r.dob
        ].map(v => `"${v || ''}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.setAttribute('download', 'customers.csv');
      a.click();
      URL.revokeObjectURL(url);
    };

    // Load customers when ViewModel is connected
    self.connected = () => self.loadCustomers();
  }

  return CustomersViewModel;
});
