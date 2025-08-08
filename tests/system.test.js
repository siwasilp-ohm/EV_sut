const request = require('supertest');
const { sequelize } = require('../server/models');
const app = require('../server/app');

describe('EV Solar Charging System - Comprehensive Tests', () => {
  let authToken;
  let adminToken;
  let testUser;
  let testStation;

  beforeAll(async () => {
    // Initialize test database
    await sequelize.sync({ force: true });
    
    // Create test users
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'testuser',
        password: '123456',
        email: 'test@example.com',
        full_name: 'Test User',
        phone: '0812345678'
      });
    
    testUser = userResponse.body.user;

    // Login test user
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'testuser',
        password: '123456'
      });
    
    authToken = loginResponse.body.token;

    // Login admin
    const adminLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'admin1',
        password: '123456'
      });
    
    adminToken = adminLoginResponse.body.token;
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('Authentication System', () => {
    test('Should register new user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'newuser',
          password: '123456',
          email: 'newuser@example.com',
          full_name: 'New User',
          phone: '0823456789'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.user).toHaveProperty('id');
    });

    test('Should not register user with duplicate username', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          password: '123456',
          email: 'duplicate@example.com',
          full_name: 'Duplicate User',
          phone: '0834567890'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('Should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: '123456'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('token');
    });

    test('Should not login with invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('Should verify valid token', async () => {
      const response = await request(app)
        .post('/api/auth/verify')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(true);
    });
  });

  describe('User Management', () => {
    test('Should get user profile', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user.username).toBe('testuser');
    });

    test('Should update user profile', async () => {
      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          full_name: 'Updated Test User',
          phone: '0887654321'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('Should add user vehicle', async () => {
      const response = await request(app)
        .post('/api/users/vehicles')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          make: 'Tesla',
          model: 'Model 3',
          year: 2023,
          license_plate: 'ABC-1234',
          battery_capacity: 75,
          is_default: true
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.vehicle).toHaveProperty('id');
    });
  });

  describe('Charging Stations', () => {
    test('Should get list of charging stations', async () => {
      const response = await request(app)
        .get('/api/stations');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.stations)).toBe(true);
    });

    test('Should get station details', async () => {
      // First get stations list
      const stationsResponse = await request(app)
        .get('/api/stations');
      
      if (stationsResponse.body.stations.length > 0) {
        const stationId = stationsResponse.body.stations[0].id;
        
        const response = await request(app)
          .get(`/api/stations/${stationId}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.station).toHaveProperty('id');
      }
    });
  });

  describe('Payment System', () => {
    test('Should generate PromptPay QR code', async () => {
      const response = await request(app)
        .post('/api/payments/promptpay/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 100
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('qr_code');
      expect(response.body).toHaveProperty('transaction_id');
    });

    test('Should get wallet balance', async () => {
      const response = await request(app)
        .get('/api/payments/wallet')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('balance');
    });
  });

  describe('Admin Functions', () => {
    test('Should get dashboard stats (admin only)', async () => {
      const response = await request(app)
        .get('/api/admin/dashboard/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('stats');
    });

    test('Should deny access to non-admin users', async () => {
      const response = await request(app)
        .get('/api/admin/dashboard/stats')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    test('Should get users list (admin only)', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.users)).toBe(true);
    });
  });

  describe('Energy Management', () => {
    test('Should get inverter status', async () => {
      const response = await request(app)
        .get('/api/energy/inverters')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.inverters)).toBe(true);
    });

    test('Should get energy production data', async () => {
      const response = await request(app)
        .get('/api/energy/production')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          start_date: '2023-01-01',
          end_date: '2023-12-31'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('Should handle missing authorization header', async () => {
      const response = await request(app)
        .get('/api/users/profile');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('Should handle invalid token', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('Should handle non-existent endpoints', async () => {
      const response = await request(app)
        .get('/api/nonexistent');

      expect(response.status).toBe(404);
    });
  });

  describe('Input Validation', () => {
    test('Should validate email format in registration', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser2',
          password: '123456',
          email: 'invalid-email',
          full_name: 'Test User 2',
          phone: '0812345678'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('Should validate required fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser3',
          // missing required fields
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});
