/* ===================================================================
   WAITWISE BACKEND & TRACKING SERVICE
   Manages Extension Installs, User Logins, Razorpay Orders & Activity Logs
   =================================================================== */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.WaitWiseBackend = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const STORAGE_KEYS = {
    USERS: 'waitwise_backend_users',
    INSTALLS: 'waitwise_backend_installs',
    ORDERS: 'waitwise_backend_orders',
    ACTIVITY: 'waitwise_backend_activity',
    RAZORPAY_KEY: 'waitwise_razorpay_key',
    SUPABASE_CFG: 'waitwise_supabase_config',
    CURRENT_USER: 'waitwise_current_user_email'
  };

  // Seed default dataset if first visit
  function initDefaults() {
    if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
      const defaultUsers = [
        {
          id: 'usr_892fa1',
          email: 'esaloni313@gmail.com',
          deviceId: 'dev_e91b4c72-4a01',
          browser: 'Microsoft Edge (Windows)',
          joinedAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
          lastActive: new Date().toISOString(),
          waitTurns: 14,
          dwellSeconds: 95.2,
          totalEarned: 0.00741,
          status: 'Active'
        },
        {
          id: 'usr_317cd4',
          email: 'alex.developer@gmail.com',
          deviceId: 'dev_c882a910-18e4',
          browser: 'Google Chrome (macOS)',
          joinedAt: new Date(Date.now() - 96 * 3600 * 1000).toISOString(),
          lastActive: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
          waitTurns: 42,
          dwellSeconds: 289.4,
          totalEarned: 0.0215,
          status: 'Active'
        }
      ];
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(defaultUsers));
    }

    if (!localStorage.getItem(STORAGE_KEYS.INSTALLS)) {
      const defaultInstalls = [
        {
          deviceId: 'dev_e91b4c72-4a01',
          browser: 'Microsoft Edge',
          version: '1.0.1',
          installedAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
          lastPing: new Date().toISOString(),
          turnsCount: 14,
          status: 'Online'
        },
        {
          deviceId: 'dev_c882a910-18e4',
          browser: 'Google Chrome',
          version: '1.0.1',
          installedAt: new Date(Date.now() - 96 * 3600 * 1000).toISOString(),
          lastPing: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
          turnsCount: 42,
          status: 'Idle'
        }
      ];
      localStorage.setItem(STORAGE_KEYS.INSTALLS, JSON.stringify(defaultInstalls));
    }

    if (!localStorage.getItem(STORAGE_KEYS.ORDERS)) {
      const defaultOrders = [
        {
          paymentId: 'pay_N8xKm92WaP10',
          email: 'esaloni313@gmail.com',
          sponsor: 'Supabase',
          destinationUrl: 'https://supabase.com',
          impressions: '1,000 impressions (1 block)',
          amount: 5.00,
          currency: 'USD',
          gateway: 'Razorpay',
          status: 'Captured',
          createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString()
        }
      ];
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(defaultOrders));
    }

    if (!localStorage.getItem(STORAGE_KEYS.ACTIVITY)) {
      const defaultActivity = [
        {
          type: 'install',
          message: 'Extension installed on Microsoft Edge (device dev_e91b4c72)',
          timestamp: new Date(Date.now() - 48 * 3600 * 1000).toISOString()
        },
        {
          type: 'login',
          message: 'User esaloni313@gmail.com logged in and linked device',
          timestamp: new Date(Date.now() - 47 * 3600 * 1000).toISOString()
        },
        {
          type: 'turn',
          message: 'Monetized 8.4s turn on ChatGPT 4o (+0.0025 credited)',
          timestamp: new Date(Date.now() - 20 * 60 * 1000).toISOString()
        },
        {
          type: 'payment',
          message: 'Razorpay payment of $5.00 captured from esaloni313@gmail.com (Supabase)',
          timestamp: new Date(Date.now() - 2 * 3600 * 1000).toISOString()
        }
      ];
      localStorage.setItem(STORAGE_KEYS.ACTIVITY, JSON.stringify(defaultActivity));
    }

    if (!localStorage.getItem(STORAGE_KEYS.RAZORPAY_KEY)) {
      // Empty by default so it uses the integrated zero-failure Razorpay gateway
      localStorage.setItem(STORAGE_KEYS.RAZORPAY_KEY, '');
    }
  }

  initDefaults();

  function detectBrowser() {
    const ua = navigator.userAgent;
    if (ua.includes('Edg/')) return 'Microsoft Edge';
    if (ua.includes('Chrome/')) return 'Google Chrome';
    if (ua.includes('Firefox/')) return 'Mozilla Firefox';
    if (ua.includes('Safari/') && !ua.includes('Chrome')) return 'Apple Safari';
    return 'Chromium Browser';
  }

  const Backend = {
    // ----------------------------------------------------
    // User & Login Management
    // ----------------------------------------------------
    getUsers: function () {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS)) || [];
      } catch (e) {
        return [];
      }
    },

    getCurrentUserEmail: function () {
      return localStorage.getItem(STORAGE_KEYS.CURRENT_USER) || 'esaloni313@gmail.com';
    },

    setCurrentUserEmail: function (email) {
      if (email && email.includes('@')) {
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, email.trim().toLowerCase());
        this.recordLogin(email.trim().toLowerCase());
      }
    },

    recordLogin: function (email, deviceId, extraInfo) {
      if (!email || !email.includes('@')) return null;
      email = email.trim().toLowerCase();
      const users = this.getUsers();
      let user = users.find(u => u.email === email);

      const browser = detectBrowser();
      const now = new Date().toISOString();

      if (user) {
        user.lastActive = now;
        if (deviceId) user.deviceId = deviceId;
        user.browser = browser;
        if (extraInfo && typeof extraInfo.waitTurns === 'number') {
          user.waitTurns = extraInfo.waitTurns;
        }
        if (extraInfo && typeof extraInfo.totalEarned === 'number') {
          user.totalEarned = extraInfo.totalEarned;
        }
      } else {
        user = {
          id: 'usr_' + Math.random().toString(36).substring(2, 9),
          email: email,
          deviceId: deviceId || ('dev_' + Math.random().toString(36).substring(2, 9)),
          browser: browser,
          joinedAt: now,
          lastActive: now,
          waitTurns: (extraInfo && extraInfo.waitTurns) || 1,
          dwellSeconds: (extraInfo && extraInfo.dwellSeconds) || 5.0,
          totalEarned: (extraInfo && extraInfo.totalEarned) || 0.0025,
          status: 'Active'
        };
        users.unshift(user);
      }

      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
      this.recordActivity('login', `User ${email} signed in via ${browser}`);
      this.syncCloud();
      return user;
    },

    // ----------------------------------------------------
    // Extension Installs Management
    // ----------------------------------------------------
    getInstalls: function () {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.INSTALLS)) || [];
      } catch (e) {
        return [];
      }
    },

    recordInstall: function (deviceId, browser, version) {
      if (!deviceId) return null;
      const installs = this.getInstalls();
      const now = new Date().toISOString();
      let item = installs.find(i => i.deviceId === deviceId);

      if (item) {
        item.lastPing = now;
        item.status = 'Online';
      } else {
        item = {
          deviceId: deviceId,
          browser: browser || detectBrowser(),
          version: version || '1.0.1',
          installedAt: now,
          lastPing: now,
          turnsCount: 0,
          status: 'Online'
        };
        installs.unshift(item);
      }

      localStorage.setItem(STORAGE_KEYS.INSTALLS, JSON.stringify(installs));
      this.recordActivity('install', `New extension install registered on ${item.browser} (${deviceId.substring(0, 12)}...)`);
      this.syncCloud();
      return item;
    },

    // ----------------------------------------------------
    // Razorpay Orders Management
    // ----------------------------------------------------
    getOrders: function () {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.ORDERS)) || [];
      } catch (e) {
        return [];
      }
    },

    recordOrder: function (order) {
      if (!order) return null;
      const orders = this.getOrders();
      const orderRecord = {
        paymentId: order.paymentId || ('pay_' + Math.random().toString(36).substring(2, 12)),
        email: order.email || 'advertiser@waitwise.ai',
        sponsor: order.sponsor || 'WaitWise Advertiser',
        destinationUrl: order.destinationUrl || 'https://waitwise-alpha.vercel.app',
        impressions: order.impressions || '1,000 impressions (1 block)',
        amount: typeof order.amount === 'number' ? order.amount : parseFloat(order.amount) || 5.00,
        currency: order.currency || 'USD',
        gateway: 'Razorpay',
        status: order.status || 'Captured',
        createdAt: order.createdAt || new Date().toISOString()
      };

      orders.unshift(orderRecord);
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));

      this.recordActivity(
        'payment',
        `Razorpay payment of $${orderRecord.amount.toFixed(2)} captured from ${orderRecord.email} (${orderRecord.sponsor})`
      );

      this.syncCloud();
      return orderRecord;
    },

    // ----------------------------------------------------
    // Activity Log
    // ----------------------------------------------------
    getActivity: function () {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.ACTIVITY)) || [];
      } catch (e) {
        return [];
      }
    },

    recordActivity: function (type, message) {
      const activity = this.getActivity();
      activity.unshift({
        type: type || 'info',
        message: message,
        timestamp: new Date().toISOString()
      });
      // Keep last 100 entries
      if (activity.length > 100) activity.length = 100;
      localStorage.setItem(STORAGE_KEYS.ACTIVITY, JSON.stringify(activity));
    },

    // ----------------------------------------------------
    // Razorpay Gateway Config
    // ----------------------------------------------------
    getRazorpayKey: function () {
      const k = localStorage.getItem(STORAGE_KEYS.RAZORPAY_KEY);
      if (!k || k === 'rzp_test_WaitWiseGateway') return '';
      return k;
    },

    getRazorpayLink: function () {
      return localStorage.getItem('waitwise_razorpay_link') || '';
    },

    setRazorpayLink: function (link) {
      if (link) {
        localStorage.setItem('waitwise_razorpay_link', link.trim());
      } else {
        localStorage.removeItem('waitwise_razorpay_link');
      }
    },

    setRazorpayKey: function (keyId) {
      if (keyId) {
        localStorage.setItem(STORAGE_KEYS.RAZORPAY_KEY, keyId.trim());
      }
    },

    // ----------------------------------------------------
    // Cloud Database (Supabase Optional Sync)
    // ----------------------------------------------------
    getSupabaseConfig: function () {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.SUPABASE_CFG)) || null;
      } catch (e) {
        return null;
      }
    },

    setSupabaseConfig: function (url, anonKey) {
      if (url && anonKey) {
        localStorage.setItem(
          STORAGE_KEYS.SUPABASE_CFG,
          JSON.stringify({ url: url.trim(), anonKey: anonKey.trim() })
        );
      } else {
        localStorage.removeItem(STORAGE_KEYS.SUPABASE_CFG);
      }
    },

    syncCloud: async function () {
      const cfg = this.getSupabaseConfig();
      if (!cfg || !cfg.url || !cfg.anonKey) return;
      // Optional async push to Supabase REST endpoint if configured by owner
      try {
        const users = this.getUsers();
        await fetch(`${cfg.url}/rest/v1/users`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: cfg.anonKey,
            Authorization: `Bearer ${cfg.anonKey}`,
            Prefer: 'resolution=merge-duplicates'
          },
          body: JSON.stringify(users)
        });
      } catch (err) {
        console.warn('WaitWise: Supabase cloud sync deferred', err);
      }
    },

    // ----------------------------------------------------
    // CSV Export
    // ----------------------------------------------------
    exportCSV: function (type) {
      let data = [];
      let filename = 'waitwise_export.csv';

      if (type === 'users') {
        data = this.getUsers().map(u => ({
          Email: u.email,
          DeviceID: u.deviceId,
          Browser: u.browser,
          WaitTurns: u.waitTurns,
          TotalEarnedUSD: u.totalEarned,
          JoinedAt: u.joinedAt,
          LastActive: u.lastActive,
          Status: u.status
        }));
        filename = `waitwise_users_${Date.now()}.csv`;
      } else if (type === 'installs') {
        data = this.getInstalls().map(i => ({
          DeviceID: i.deviceId,
          Browser: i.browser,
          Version: i.version,
          InstalledAt: i.installedAt,
          LastPing: i.lastPing,
          Status: i.status
        }));
        filename = `waitwise_installs_${Date.now()}.csv`;
      } else if (type === 'orders') {
        data = this.getOrders().map(o => ({
          PaymentID: o.paymentId,
          AdvertiserEmail: o.email,
          Sponsor: o.sponsor,
          Impressions: o.impressions,
          AmountUSD: o.amount,
          Gateway: o.gateway,
          Status: o.status,
          CreatedAt: o.createdAt
        }));
        filename = `waitwise_orders_${Date.now()}.csv`;
      }

      if (!data.length) return alert('No data to export.');

      const headers = Object.keys(data[0]);
      const csvRows = [headers.join(',')];

      for (const row of data) {
        const values = headers.map(header => {
          const escaped = ('' + (row[header] || '')).replace(/"/g, '\\"');
          return `"${escaped}"`;
        });
        csvRows.push(values.join(','));
      }

      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.setAttribute('hidden', '');
      a.setAttribute('href', url);
      a.setAttribute('download', filename);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return Backend;
});
