define([], function () {
  'use strict';

  const API = {
    core: 'http://localhost:8080/api/v1'
  };

  async function request(url, options = {}) {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      ...options
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error ${response.status}: ${errorText}`);
    }

    // Return JSON only if available
    const contentType = response.headers.get('content-type');
    if (response.status !== 204 && contentType && contentType.includes('application/json')) {
      return response.json();
    }
    return null;
  }

  return {
    customers: {
      getAll: () => request(`${API.core}/customers`),

      get: (id) => request(`${API.core}/customers/${id}`),

      create: (data) =>
        request(`${API.core}/customers`, {
          method: 'POST',
          body: JSON.stringify({
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            phone: data.phone,
            dob: data.dob
          })
        }),

      update: (id, data) =>
        request(`${API.core}/customers/${id}`, {
          method: 'PATCH', // use full replace (PUT) unless backend expects PATCH
          body: JSON.stringify({
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            phone: data.phone,
            dob: data.dob
          })
        }),

      remove: (id) =>
        request(`${API.core}/customers/${id}`, {
          method: 'DELETE'
        })
    },

    products: {
      getAll: (activeOnly = false) => {
        const url = activeOnly 
          ? `${API.core}/products?active=true`
          : `${API.core}/products`;
        return request(url);
      },

      get: (id) => request(`${API.core}/products/${id}`),

      create: (data) =>
        request(`${API.core}/products`, {
          method: 'POST',
          body: JSON.stringify({
            name: data.name,
            code: data.code,
            description: data.description,
            baseRatePer1000: data.baseRatePer1000,
            minSumAssured: data.minSumAssured,
            maxSumAssured: data.maxSumAssured,
            minTermMonths: data.minTermMonths,
            maxTermMonths: data.maxTermMonths,
            active: data.active
          })
        }),

      update: (id, data) =>
        request(`${API.core}/products/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: data.name,
            code: data.code,
            description: data.description,
            baseRatePer1000: data.baseRatePer1000,
            minSumAssured: data.minSumAssured,
            maxSumAssured: data.maxSumAssured,
            minTermMonths: data.minTermMonths,
            maxTermMonths: data.maxTermMonths,
            active: data.active
          })
        }),

      remove: (id) =>
        request(`${API.core}/products/${id}`, {
          method: 'DELETE'
        })
    },
    quotes: {
      getAll: (customerId, status) => {
        let url = `${API.core}/quotes`;
        const params = [];
        if (customerId) params.push(`customer_id=${customerId}`);
        if (status) params.push(`status=${status}`);
        if (params.length > 0) url += `?${params.join("&")}`;
        return request(url);
      },

      get: (id) => request(`${API.core}/quotes/${id}`),

      create: (data) =>
        request(`${API.core}/quotes`, {
          method: 'POST',
          body: JSON.stringify({
            customerId: data.customerId,
            productId: data.productId,
            sumAssured: data.sumAssured,
            termMonths: data.termMonths
          })
        }),

      update: (id, data) =>
        request(`${API.core}/quotes/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            sumAssured: data.sumAssured,
            termMonths: data.termMonths
          })
        }),

      price: (id) =>
        request(`${API.core}/quotes/${id}/price`, {
          method: 'POST'
        }),

      confirm: (id) =>
        request(`${API.core}/quotes/${id}/confirm`, {
          method: 'POST'
        })
    }
  };
});
