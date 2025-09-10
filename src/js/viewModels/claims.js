define([
  "knockout",
  "ojs/ojarraydataprovider",
  "services/apiService",
  "ojs/ojdialog",
  "ojs/ojmessages",
  "ojs/ojbutton",
  "ojs/ojtable",
  "ojs/ojformlayout",
"ojs/ojdatetimepicker",
  "ojs/ojinputnumber",
  "ojs/ojinputtext"
], function (ko, ArrayDataProvider, api) {
  function ClaimsViewModel() {
    let self = this;

    // Data + Messages
    self.claims = ko.observableArray([]);
    self.claimsDP = new ArrayDataProvider(self.claims, { keyAttributes: "id" });
    self.messages = ko.observableArray([]);

    // Dialog states
    self.newClaim = {
      policyId: ko.observable(""),
      description: ko.observable(""),
      lossDate: ko.observable("")
    };

    self.selectedClaim = {
      id: ko.observable(""),
      description: ko.observable(""),
      lossDate: ko.observable("")
    };

    self.assessData = {
      id: ko.observable(""),
      decision: ko.observable(""),
      approvedAmount: ko.observable(null),
      reason: ko.observable("")
    };

    // ---- API Calls ----
    self.loadClaims = async function () {
      try {
        let data = await api.claims.getAll();
        self.claims(data);
      } catch (e) {
        self.messages.push({ severity: "error", summary: "Failed to load claims", detail: e.message });
      }
    };

    self.fileClaim = async function () {
      try {
        await api.claims.create({
          policyId: self.newClaim.policyId(),
          description: self.newClaim.description(),
          lossDate: self.newClaim.lossDate()
        });
        document.getElementById("newClaimDialog").close();
        self.loadClaims();
      } catch (e) {
        self.messages.push({ severity: "error", summary: "Failed to file claim", detail: e.message });
      }
    };

    self.updateClaim = async function () {
      try {
        await api.claims.update(self.selectedClaim.id(), {
          description: self.selectedClaim.description(),
          lossDate: self.selectedClaim.lossDate()
        });
        document.getElementById("updateClaimDialog").close();
        self.loadClaims();
      } catch (e) {
        self.messages.push({ severity: "error", summary: "Failed to update claim", detail: e.message });
      }
    };

    self.assessClaim = async function () {
      try {
        await api.claims.assess(self.assessData.id(), {
          decision: self.assessData.decision(),
          approvedAmount: self.assessData.approvedAmount(),
          reason: self.assessData.reason()
        });
        document.getElementById("assessClaimDialog").close();
        self.loadClaims();
      } catch (e) {
        self.messages.push({ severity: "error", summary: "Failed to assess claim", detail: e.message });
      }
    };

    self.closeClaim = async function (row) {
      try {
        await api.claims.close(row.id);
        self.loadClaims();
      } catch (e) {
        self.messages.push({ severity: "error", summary: "Failed to close claim", detail: e.message });
      }
    };

    // ---- Dialog helpers ----
    self.openNewClaimDialog = () => document.getElementById("newClaimDialog").open();
    self.closeNewClaimDialog = () => document.getElementById("newClaimDialog").close();

    self.openUpdateDialog = (row) => {
      self.selectedClaim.id(row.id);
      self.selectedClaim.description(row.description);
      self.selectedClaim.lossDate(row.lossDate);
      document.getElementById("updateClaimDialog").open();
    };
    self.closeUpdateDialog = () => document.getElementById("updateClaimDialog").close();

    self.openAssessDialog = (row) => {
      self.assessData.id(row.id);
      self.assessData.decision("");
      self.assessData.approvedAmount(null);
      self.assessData.reason("");
      document.getElementById("assessClaimDialog").open();
    };
    self.closeAssessDialog = () => document.getElementById("assessClaimDialog").close();

    // Initial load
    self.loadClaims();
  }

  return ClaimsViewModel;
});
