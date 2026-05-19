/**
 * apiService.js - Servicio centralizado para peticiones a la API
 */

// Usar la URL dinámica de config.js o una ruta relativa como último recurso
const URL_BASE = typeof API_URL !== 'undefined' ? API_URL : '/api';

class ApiService {
  static getHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };
    
    const token = localStorage.getItem('token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return headers;
  }

  static async get(endpoint) {
    const response = await fetch(`${URL_BASE}${endpoint}`, {
      method: 'GET',
      headers: this.getHeaders()
    });
    return this.handleResponse(response);
  }

  static async post(endpoint, data) {
    const isFormData = data instanceof FormData;
    const headers = this.getHeaders();
    
    // Si es FormData, dejamos que el navegador ponga el Content-Type con el boundary correcto
    if (isFormData) {
      delete headers['Content-Type'];
    }

    const response = await fetch(`${URL_BASE}${endpoint}`, {
      method: 'POST',
      headers: headers,
      body: isFormData ? data : JSON.stringify(data)
    });
    return this.handleResponse(response);
  }

  static async put(endpoint, data) {
    const response = await fetch(`${URL_BASE}${endpoint}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    });
    return this.handleResponse(response);
  }

  static async patch(endpoint, data) {
    const response = await fetch(`${URL_BASE}${endpoint}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    });
    return this.handleResponse(response);
  }

  static async delete(endpoint) {
    const response = await fetch(`${URL_BASE}${endpoint}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    return this.handleResponse(response);
  }

  static async handleResponse(response) {
    const contentType = response.headers.get("content-type");
    let data;
    
    if (contentType && contentType.indexOf("application/json") !== -1) {
      try {
        data = await response.json();
      } catch (e) {
        const text = await response.text();
        data = { message: text || 'Error de formato en la respuesta del servidor' };
      }
    } else {
      const text = await response.text();
      data = { message: text || 'Error desconocido del servidor' };
    }

    if (!response.ok) {
      // Si el token es inválido (401), cerrar sesión
      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/pages/login.html';
      }
      const errorMessage = data.error 
        ? `${data.message}: ${data.error}` 
        : (data.message || 'Error en la petición');
      throw new Error(errorMessage);
    }
    return data;
  }
}

// Exportar de forma global
if (typeof window !== 'undefined') {
  window.ApiService = ApiService;
}
