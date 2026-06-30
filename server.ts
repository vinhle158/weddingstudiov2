import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { LocalDatabase, User, Customer, Order, OrderStatusHistory, Task, TaskUpdate, Role, Objective, ObjectiveKeyResult, ObjectiveProgressUpdate, Notification, ChatMessage, Lead, LeadFeedback } from './src/db_service';

// Extend Express Request type to include authenticated user
interface AuthenticatedRequest extends Request {
  user?: User;
  role?: Role;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // ----------------- AUTHENTICATION MIDDLEWARE -----------------
  const authenticate = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing token' });
    }
    const userId = authHeader.split(' ')[1];
    const db = LocalDatabase.get();
    const user = db.users.find(u => u.id === userId);
    
    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or inactive user' });
    }

    const role = db.roles.find(r => r.id === user.role_id);
    req.user = user;
    req.role = role;
    next();
  };

  // Helper to check standard permission keys
  const requirePermission = (permission: string) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.role) {
        return res.status(403).json({ error: 'Forbidden: No role assigned' });
      }
      if (req.role.permissions.includes(permission) || req.role.permissions.includes('admin') || req.role.id === 'role-admin') {
        return next();
      }
      return res.status(403).json({ error: `Forbidden: Missing permission [${permission}]` });
    };
  };

  // ----------------- AUTH ENDPOINTS -----------------
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Vui lòng cung cấp email và mật khẩu' });
    }

    const db = LocalDatabase.get();
    const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (!user || user.password_hash !== password) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Tài khoản đã bị vô hiệu hóa' });
    }

    const role = db.roles.find(r => r.id === user.role_id);
    res.json({
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role_id: user.role_id
      },
      role
    });
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    res.json({ success: true, message: 'Đăng xuất thành công' });
  });

  app.get('/api/auth/me', authenticate, (req: AuthenticatedRequest, res: Response) => {
    res.json({
      user: {
        id: req.user?.id,
        full_name: req.user?.full_name,
        email: req.user?.email,
        role_id: req.user?.role_id
      },
      role: req.role
    });
  });

  // ----------------- USERS & ROLES ENDPOINTS -----------------
  app.get('/api/users', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const db = LocalDatabase.get();
    const usersWithRoles = db.users.map(u => {
      const r = db.roles.find(role => role.id === u.role_id);
      return {
        ...u,
        role_name: r ? r.display_name : 'No role'
      };
    });
    res.json(usersWithRoles);
  });

  app.post('/api/users', authenticate, requirePermission('users.manage'), (req: AuthenticatedRequest, res: Response) => {
    const { full_name, email, password, role_id } = req.body;
    if (!full_name || !email || !password || !role_id) {
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });
    }

    const db = LocalDatabase.get();
    if (db.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      return res.status(400).json({ error: 'Email này đã được sử dụng' });
    }

    const newUser: User = {
      id: 'user-' + LocalDatabase.uuid(),
      full_name,
      email,
      password_hash: password,
      role_id,
      is_active: true,
      created_at: new Date().toISOString()
    };

    db.users.push(newUser);
    LocalDatabase.save(db);

    res.status(201).json(newUser);
  });

  app.put('/api/users/:id', authenticate, requirePermission('users.manage'), (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { full_name, email, password, role_id, is_active } = req.body;

    const db = LocalDatabase.get();
    const idx = db.users.findIndex(u => u.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    }

    if (email && email.toLowerCase() !== db.users[idx].email.toLowerCase()) {
      if (db.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
        return res.status(400).json({ error: 'Email này đã được sử dụng' });
      }
      db.users[idx].email = email;
    }

    if (full_name) db.users[idx].full_name = full_name;
    if (password) db.users[idx].password_hash = password;
    if (role_id) db.users[idx].role_id = role_id;
    if (is_active !== undefined) db.users[idx].is_active = is_active;

    LocalDatabase.save(db);
    res.json(db.users[idx]);
  });

  app.delete('/api/users/:id', authenticate, requirePermission('users.manage'), (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const db = LocalDatabase.get();
    const idx = db.users.findIndex(u => u.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    }

    // Soft delete
    db.users[idx].is_active = false;
    LocalDatabase.save(db);
    res.json({ success: true, message: 'Đã vô hiệu hóa tài khoản thành công', user: db.users[idx] });
  });

  app.get('/api/roles', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const db = LocalDatabase.get();
    res.json(db.roles);
  });

  app.post('/api/roles', authenticate, requirePermission('users.manage'), (req: AuthenticatedRequest, res: Response) => {
    const { name, display_name, permissions } = req.body;
    if (!name || !display_name || !permissions) {
      return res.status(400).json({ error: 'Thiếu thông tin tạo role' });
    }

    const db = LocalDatabase.get();
    if (db.roles.some(r => r.name.toLowerCase() === name.toLowerCase())) {
      return res.status(400).json({ error: 'Tên vai trò này đã tồn tại' });
    }

    const newRole: Role = {
      id: 'role-' + LocalDatabase.uuid(),
      name,
      display_name,
      permissions
    };

    db.roles.push(newRole);
    LocalDatabase.save(db);
    res.status(201).json(newRole);
  });

  app.put('/api/roles/:id', authenticate, requirePermission('users.manage'), (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { display_name, permissions } = req.body;

    const db = LocalDatabase.get();
    const idx = db.roles.findIndex(r => r.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Không tìm thấy vai trò' });
    }

    if (display_name) db.roles[idx].display_name = display_name;
    if (permissions) db.roles[idx].permissions = permissions;

    LocalDatabase.save(db);
    res.json(db.roles[idx]);
  });


  // ----------------- CUSTOMERS ENDPOINTS -----------------
  app.get('/api/customers', authenticate, requirePermission('customers.view'), (req: AuthenticatedRequest, res: Response) => {
    const db = LocalDatabase.get();
    const query = (req.query.q as string || '').toLowerCase();
    
    let result = db.customers;
    if (query) {
      result = db.customers.filter(c => 
        c.full_name.toLowerCase().includes(query) || 
        c.phone.includes(query) || 
        (c.email && c.email.toLowerCase().includes(query))
      );
    }
    res.json(result);
  });

  app.post('/api/customers', authenticate, requirePermission('customers.edit'), (req: AuthenticatedRequest, res: Response) => {
    const { full_name, phone, email, address, notes } = req.body;
    if (!full_name || !phone) {
      return res.status(400).json({ error: 'Thiếu họ tên hoặc số điện thoại' });
    }

    const db = LocalDatabase.get();
    const newCust: Customer = {
      id: 'cust-' + LocalDatabase.uuid(),
      full_name,
      phone,
      email: email || null,
      address: address || null,
      notes: notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    db.customers.push(newCust);
    LocalDatabase.save(db);
    res.status(201).json(newCust);
  });

  app.get('/api/customers/:id', authenticate, requirePermission('customers.view'), (req: AuthenticatedRequest, res: Response) => {
    const db = LocalDatabase.get();
    const customer = db.customers.find(c => c.id === req.params.id);
    if (!customer) {
      return res.status(404).json({ error: 'Không tìm thấy khách hàng' });
    }
    res.json(customer);
  });

  app.put('/api/customers/:id', authenticate, requirePermission('customers.edit'), (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { full_name, phone, email, address, notes } = req.body;

    const db = LocalDatabase.get();
    const idx = db.customers.findIndex(c => c.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Không tìm thấy khách hàng' });
    }

    if (full_name) db.customers[idx].full_name = full_name;
    if (phone) db.customers[idx].phone = phone;
    if (email !== undefined) db.customers[idx].email = email;
    if (address !== undefined) db.customers[idx].address = address;
    if (notes !== undefined) db.customers[idx].notes = notes;
    db.customers[idx].updated_at = new Date().toISOString();

    LocalDatabase.save(db);
    res.json(db.customers[idx]);
  });

  app.get('/api/customers/:id/orders', authenticate, requirePermission('orders.view'), (req: AuthenticatedRequest, res: Response) => {
    const db = LocalDatabase.get();
    const customerOrders = db.orders.filter(o => o.customer_id === req.params.id);
    res.json(customerOrders);
  });


  // ----------------- ORDERS ENDPOINTS -----------------
  app.get('/api/orders', authenticate, requirePermission('orders.view'), (req: AuthenticatedRequest, res: Response) => {
    const db = LocalDatabase.get();
    const { status, date, assigned_staff } = req.query;

    let result = db.orders.map(o => {
      const customer = db.customers.find(c => c.id === o.customer_id);
      return {
        ...o,
        customer_name: customer ? customer.full_name : 'Unknown',
        customer_phone: customer ? customer.phone : 'N/A'
      };
    });

    if (status) {
      result = result.filter(o => o.status === status);
    }

    if (date) {
      result = result.filter(o => o.shoot_date === date);
    }

    if (assigned_staff) {
      // Find orders that have tasks assigned to this staff member
      const matchingOrderIds = db.tasks
        .filter(t => t.assigned_to === assigned_staff && t.order_id)
        .map(t => t.order_id);
      result = result.filter(o => matchingOrderIds.includes(o.id));
    }

    res.json(result);
  });

  app.post('/api/orders', authenticate, requirePermission('orders.create'), (req: AuthenticatedRequest, res: Response) => {
    const { customer_id, shoot_date, shoot_time, package_name, notes } = req.body;
    if (!customer_id || !shoot_date || !package_name) {
      return res.status(400).json({ error: 'Thiếu thông tin tạo đơn hàng' });
    }

    const db = LocalDatabase.get();
    const customerExists = db.customers.some(c => c.id === customer_id);
    if (!customerExists) {
      return res.status(400).json({ error: 'Khách hàng không tồn tại' });
    }

    const newOrder: Order = {
      id: 'order-' + LocalDatabase.uuid(),
      order_code: LocalDatabase.generateOrderCode(),
      customer_id,
      status: 'new',
      shoot_date,
      shoot_time: shoot_time || null,
      package_name,
      notes: notes || null,
      created_by: req.user!.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    db.orders.push(newOrder);

    // Initial status history
    const history: OrderStatusHistory = {
      id: 'hist-' + LocalDatabase.uuid(),
      order_id: newOrder.id,
      from_status: '',
      to_status: 'new',
      changed_by: req.user!.id,
      note: 'Khởi tạo đơn hàng mới',
      changed_at: new Date().toISOString()
    };
    db.order_status_history.push(history);

    LocalDatabase.save(db);
    res.status(201).json(newOrder);
  });

  app.get('/api/orders/:id', authenticate, requirePermission('orders.view'), (req: AuthenticatedRequest, res: Response) => {
    const db = LocalDatabase.get();
    const order = db.orders.find(o => o.id === req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
    }

    const customer = db.customers.find(c => c.id === order.customer_id);
    const creator = db.users.find(u => u.id === order.created_by);
    const tasks = db.tasks.filter(t => t.order_id === order.id).map(t => {
      const staff = db.users.find(u => u.id === t.assigned_to);
      return {
        ...t,
        assigned_to_name: staff ? staff.full_name : 'N/A'
      };
    });
    const history = db.order_status_history.filter(h => h.order_id === order.id).map(h => {
      const changer = db.users.find(u => u.id === h.changed_by);
      return {
        ...h,
        changed_by_name: changer ? changer.full_name : 'Hệ thống'
      };
    }).sort((a,b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime());

    res.json({
      ...order,
      customer,
      created_by_name: creator ? creator.full_name : 'Ẩn danh',
      tasks,
      history
    });
  });

  app.put('/api/orders/:id', authenticate, requirePermission('orders.edit'), (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { shoot_date, shoot_time, package_name, notes } = req.body;

    const db = LocalDatabase.get();
    const idx = db.orders.findIndex(o => o.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
    }

    if (shoot_date) db.orders[idx].shoot_date = shoot_date;
    if (shoot_time !== undefined) db.orders[idx].shoot_time = shoot_time;
    if (package_name) db.orders[idx].package_name = package_name;
    if (notes !== undefined) db.orders[idx].notes = notes;
    db.orders[idx].updated_at = new Date().toISOString();

    LocalDatabase.save(db);
    res.json(db.orders[idx]);
  });

  app.post('/api/orders/:id/status', authenticate, requirePermission('orders.edit'), (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { status, note } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Vui lòng cung cấp trạng thái mới' });
    }

    const db = LocalDatabase.get();
    const idx = db.orders.findIndex(o => o.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
    }

    const oldStatus = db.orders[idx].status;

    // Rule check: Cannot transition backwards unless admin
    const statusOrder = ['new', 'confirmed', 'shooting', 'editing', 'ready', 'delivered', 'cancelled'];
    const oldIdx = statusOrder.indexOf(oldStatus);
    const newIdx = statusOrder.indexOf(status);

    if (newIdx < oldIdx && req.role?.id !== 'role-admin' && status !== 'cancelled') {
      return res.status(400).json({ 
        error: 'Chỉ Quản trị viên (Admin) mới có quyền đổi trạng thái đơn hàng quay ngược lại!' 
      });
    }

    // Change status
    db.orders[idx].status = status;
    db.orders[idx].updated_at = new Date().toISOString();

    // Log status history
    const history: OrderStatusHistory = {
      id: 'hist-' + LocalDatabase.uuid(),
      order_id: id,
      from_status: oldStatus,
      to_status: status,
      changed_by: req.user!.id,
      note: note || `Đổi trạng thái từ ${oldStatus} sang ${status}`,
      changed_at: new Date().toISOString()
    };
    db.order_status_history.push(history);

    LocalDatabase.save(db);
    res.json({ success: true, order: db.orders[idx], history });
  });

  app.get('/api/orders/:id/tasks', authenticate, requirePermission('orders.view'), (req: AuthenticatedRequest, res: Response) => {
    const db = LocalDatabase.get();
    const tasks = db.tasks.filter(t => t.order_id === req.params.id).map(t => {
      const staff = db.users.find(u => u.id === t.assigned_to);
      return {
        ...t,
        assigned_to_name: staff ? staff.full_name : 'N/A'
      };
    });
    res.json(tasks);
  });




  // ----------------- TASKS ENDPOINTS -----------------
  app.get('/api/tasks', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const db = LocalDatabase.get();
    const { assigned_to, status, order_id, date } = req.query;

    let result = db.tasks.map(t => {
      const staff = db.users.find(u => u.id === t.assigned_to);
      const manager = db.users.find(u => u.id === t.assigned_by);
      const order = db.orders.find(o => o.id === t.order_id);
      const customer = order ? db.customers.find(c => c.id === order.customer_id) : null;
      return {
        ...t,
        assigned_to_name: staff ? staff.full_name : 'No one',
        assigned_by_name: manager ? manager.full_name : 'System',
        order_code: order ? order.order_code : null,
        customer_name: customer ? customer.full_name : null,
        customer_phone: customer ? customer.phone : null
      };
    });

    // Rule: Staff can only see their own tasks
    if (req.role?.id === 'role-staff' || req.role?.id === 'role-photographer' || req.role?.id === 'role-editor' || req.role?.permissions.includes('tasks.view_own') && !req.role?.permissions.includes('tasks.view_all')) {
      result = result.filter(t => t.assigned_to === req.user?.id);
    } else if (assigned_to) {
      result = result.filter(t => t.assigned_to === assigned_to);
    }

    if (status) {
      result = result.filter(t => t.status === status);
    }

    if (order_id) {
      result = result.filter(t => t.order_id === order_id);
    }

    if (date) {
      result = result.filter(t => t.due_date === date);
    }

    res.json(result);
  });

  app.post('/api/tasks', authenticate, requirePermission('tasks.assign'), (req: AuthenticatedRequest, res: Response) => {
    const { title, description, order_id, assigned_to, priority, due_date } = req.body;
    if (!title || !assigned_to) {
      return res.status(400).json({ error: 'Thiếu tên công việc hoặc nhân viên thực hiện' });
    }

    const db = LocalDatabase.get();
    const staffExists = db.users.some(u => u.id === assigned_to);
    if (!staffExists) {
      return res.status(400).json({ error: 'Nhân viên được giao không tồn tại' });
    }

    const newTask: Task = {
      id: 'task-' + LocalDatabase.uuid(),
      title,
      description: description || null,
      order_id: order_id || null,
      assigned_to,
      assigned_by: req.user!.id,
      status: 'pending',
      priority: priority || 'normal',
      due_date: due_date || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    db.tasks.push(newTask);

    // Initial update history
    const update: TaskUpdate = {
      id: 'up-' + LocalDatabase.uuid(),
      task_id: newTask.id,
      updated_by: req.user!.id,
      status_changed_to: 'pending',
      comment: 'Tạo công việc và giao cho nhân viên',
      created_at: new Date().toISOString()
    };
    db.task_updates.push(update);

    if (!db.notifications) db.notifications = [];
    db.notifications.push({
      id: 'notif-' + LocalDatabase.uuid(),
      sender_id: req.user!.id,
      receiver_id: assigned_to,
      title: 'Công việc mới được giao',
      content: `Bạn được giao nhiệm vụ mới: "${title}". Hạn chót: ${due_date || 'Không có'}.`,
      type: 'task_assignment',
      related_id: newTask.id,
      is_read_by: [],
      created_at: new Date().toISOString()
    });

    LocalDatabase.save(db);
    res.status(201).json(newTask);
  });

  app.get('/api/tasks/:id', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const db = LocalDatabase.get();
    const task = db.tasks.find(t => t.id === req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Không tìm thấy công việc' });
    }

    // Role check: Staff cannot view other staff's task details
    if (req.role?.id !== 'role-admin' && req.role?.id !== 'role-manager' && task.assigned_to !== req.user?.id) {
      return res.status(403).json({ error: 'Không có quyền truy cập công việc của người khác' });
    }

    const staff = db.users.find(u => u.id === task.assigned_to);
    const creator = db.users.find(u => u.id === task.assigned_by);
    const order = db.orders.find(o => o.id === task.order_id);
    const customer = order ? db.customers.find(c => c.id === order.customer_id) : null;
    const updates = db.task_updates
      .filter(u => u.task_id === task.id)
      .map(u => {
        const updater = db.users.find(usr => usr.id === u.updated_by);
        return {
          ...u,
          updated_by_name: updater ? updater.full_name : 'Ẩn danh'
        };
      })
      .sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    res.json({
      ...task,
      assigned_to_name: staff ? staff.full_name : 'N/A',
      assigned_by_name: creator ? creator.full_name : 'N/A',
      order,
      customer,
      updates
    });
  });

  app.put('/api/tasks/:id', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { title, description, assigned_to, status, priority, due_date } = req.body;

    const db = LocalDatabase.get();
    const idx = db.tasks.findIndex(t => t.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Không tìm thấy công việc' });
    }

    const task = db.tasks[idx];

    // Staff can only update task STATUS. Admin/Manager can update everything.
    const isManager = req.role?.id === 'role-admin' || req.role?.id === 'role-manager' || req.role?.permissions.includes('tasks.assign');

    if (!isManager && task.assigned_to !== req.user?.id) {
      return res.status(403).json({ error: 'Không có quyền sửa công việc của người khác' });
    }

    const oldStatus = task.status;

    if (isManager) {
      if (title) task.title = title;
      if (description !== undefined) task.description = description;
      if (assigned_to) task.assigned_to = assigned_to;
      if (priority) task.priority = priority;
      if (due_date !== undefined) task.due_date = due_date;
    }

    let statusLogged = false;
    if (status && status !== oldStatus) {
      task.status = status;
      statusLogged = true;

      // Log status change
      const update: TaskUpdate = {
        id: 'up-' + LocalDatabase.uuid(),
        task_id: id,
        updated_by: req.user!.id,
        status_changed_to: status,
        comment: `Thay đổi trạng thái công việc từ "${oldStatus}" sang "${status}"`,
        created_at: new Date().toISOString()
      };
      db.task_updates.push(update);
    }

    task.updated_at = new Date().toISOString();
    
    if (status && status !== oldStatus) {
      if (!db.notifications) db.notifications = [];
      const receiver = req.user!.id === task.assigned_to ? task.assigned_by : task.assigned_to;
      db.notifications.push({
        id: 'notif-' + LocalDatabase.uuid(),
        sender_id: req.user!.id,
        receiver_id: receiver,
        title: 'Trạng thái công việc thay đổi',
        content: `Công việc "${task.title}" đã chuyển từ "${oldStatus}" sang "${status}".`,
        type: 'task_assignment',
        related_id: task.id,
        is_read_by: [],
        created_at: new Date().toISOString()
      });
    }

    LocalDatabase.save(db);

    res.json(task);
  });

  app.post('/api/tasks/:id/updates', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { status_changed_to, comment } = req.body;

    if (!comment) {
      return res.status(400).json({ error: 'Vui lòng cung cấp nội dung ghi chú cập nhật' });
    }

    const db = LocalDatabase.get();
    const idx = db.tasks.findIndex(t => t.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Không tìm thấy công việc' });
    }

    const task = db.tasks[idx];

    if (task.assigned_to !== req.user?.id && req.role?.id !== 'role-admin' && req.role?.id !== 'role-manager') {
      return res.status(403).json({ error: 'Bạn không được phân công thực hiện công việc này' });
    }

    const oldStatus = task.status;

    if (status_changed_to && status_changed_to !== oldStatus) {
      task.status = status_changed_to;
      task.updated_at = new Date().toISOString();
    }

    const update: TaskUpdate = {
      id: 'up-' + LocalDatabase.uuid(),
      task_id: id,
      updated_by: req.user!.id,
      status_changed_to: status_changed_to || null,
      comment,
      created_at: new Date().toISOString()
    };

    db.task_updates.push(update);

    if (!db.notifications) db.notifications = [];
    const receiver = req.user!.id === task.assigned_to ? task.assigned_by : task.assigned_to;
    db.notifications.push({
      id: 'notif-' + LocalDatabase.uuid(),
      sender_id: req.user!.id,
      receiver_id: receiver,
      title: status_changed_to && status_changed_to !== oldStatus ? 'Trạng thái công việc thay đổi' : 'Cập nhật tiến độ công việc',
      content: status_changed_to && status_changed_to !== oldStatus 
        ? `Công việc "${task.title}" đổi sang "${status_changed_to}" với ghi chú: "${comment}"`
        : `Ghi chú mới cho công việc "${task.title}": "${comment}"`,
      type: 'task_assignment',
      related_id: task.id,
      is_read_by: [],
      created_at: new Date().toISOString()
    });

    LocalDatabase.save(db);

    res.status(201).json(update);
  });

  app.get('/api/tasks/:id/updates', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const db = LocalDatabase.get();
    const updates = db.task_updates
      .filter(u => u.task_id === req.params.id)
      .map(u => {
        const user = db.users.find(usr => usr.id === u.updated_by);
        return {
          ...u,
          updated_by_name: user ? user.full_name : 'N/A'
        };
      })
      .sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    res.json(updates);
  });





  // ----------------- DASHBOARD ENDPOINTS -----------------
  app.get('/api/dashboard/summary', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const db = LocalDatabase.get();
    
    // Status counts of orders
    const orderStatuses: Record<string, number> = {
      new: 0, confirmed: 0, shooting: 0, editing: 0, ready: 0, delivered: 0, cancelled: 0
    };
    db.orders.forEach(o => {
      if (orderStatuses[o.status] !== undefined) {
        orderStatuses[o.status]++;
      }
    });

    // Task counts
    const totalTasks = db.tasks.length;
    const doneTasks = db.tasks.filter(t => t.status === 'done').length;

    // Count of overdue tasks
    const todayStr = new Date().toISOString().split('T')[0];
    const overdueTasksCount = db.tasks.filter(t => 
      t.status !== 'done' && 
      t.status !== 'cancelled' && 
      t.due_date && 
      t.due_date < todayStr
    ).length;

    res.json({
      orders: {
        total: db.orders.length,
        by_status: orderStatuses
      },
      tasks: {
        total: totalTasks,
        done: doneTasks,
        overdue: overdueTasksCount
      }
    });
  });

  app.get('/api/dashboard/upcoming-shoots', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const db = LocalDatabase.get();
    const today = new Date();
    const next7Days = new Date();
    next7Days.setDate(today.getDate() + 7);

    const todayStr = today.toISOString().split('T')[0];
    const next7DaysStr = next7Days.toISOString().split('T')[0];

    const upcoming = db.orders
      .filter(o => o.status !== 'cancelled' && o.shoot_date >= todayStr && o.shoot_date <= next7DaysStr)
      .map(o => {
        const cust = db.customers.find(c => c.id === o.customer_id);
        return {
          id: o.id,
          order_code: o.order_code,
          customer_name: cust ? cust.full_name : 'No Name',
          customer_phone: cust ? cust.phone : 'N/A',
          shoot_date: o.shoot_date,
          shoot_time: o.shoot_time,
          package_name: o.package_name,
          status: o.status
        };
      })
      .sort((a,b) => a.shoot_date.localeCompare(b.shoot_date) || (a.shoot_time || '').localeCompare(b.shoot_time || ''));

    res.json(upcoming);
  });

  app.get('/api/dashboard/overdue-tasks', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const db = LocalDatabase.get();
    const todayStr = new Date().toISOString().split('T')[0];

    const overdue = db.tasks
      .filter(t => t.status !== 'done' && t.status !== 'cancelled' && t.due_date && t.due_date < todayStr)
      .map(t => {
        const staff = db.users.find(u => u.id === t.assigned_to);
        const order = db.orders.find(o => o.id === t.order_id);
        return {
          id: t.id,
          title: t.title,
          priority: t.priority,
          due_date: t.due_date,
          assigned_to_name: staff ? staff.full_name : 'N/A',
          order_code: order ? order.order_code : null,
          status: t.status
        };
      })
      .sort((a,b) => (a.due_date || '').localeCompare(b.due_date || ''));

    res.json(overdue);
  });



  // ----------------- OBJECTIVES & KEY RESULTS (TARGET) ENDPOINTS -----------------
  app.get('/api/objectives', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const isManagerOrAdmin = req.role?.id === 'role-admin' || req.role?.id === 'role-manager';
    if (!isManagerOrAdmin) {
      return res.status(403).json({ error: 'Chỉ quản lý hoặc admin mới được xem mục tiêu' });
    }

    const db = LocalDatabase.get();
    
    const objectives = db.objectives || [];
    const krs = db.objective_key_results || [];

    const result = objectives.map(obj => {
      const creator = db.users.find(u => u.id === obj.created_by);
      const objKrs = krs.filter(k => k.objective_id === obj.id);
      
      // Calculate average progress
      let averageProgress = 0;
      if (objKrs.length > 0) {
        const sum = objKrs.reduce((acc, k) => acc + k.progress, 0);
        averageProgress = Math.round(sum / objKrs.length);
      }

      return {
        ...obj,
        created_by_name: creator ? creator.full_name : 'Quản trị viên',
        key_results: objKrs,
        progress: averageProgress
      };
    });

    res.json(result);
  });

  app.post('/api/objectives', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const isManagerOrAdmin = req.role?.id === 'role-admin' || req.role?.id === 'role-manager';
    if (!isManagerOrAdmin) {
      return res.status(403).json({ error: 'Chỉ quản lý hoặc admin mới được tạo mục tiêu' });
    }

    const { title, description } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Thiếu tên mục tiêu' });
    }

    const db = LocalDatabase.get();
    if (!db.objectives) db.objectives = [];

    const newObj: Objective = {
      id: 'obj-' + LocalDatabase.uuid(),
      title,
      description: description || null,
      status: 'active',
      created_by: req.user!.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: null
    };

    db.objectives.push(newObj);
    LocalDatabase.save(db);

    res.status(201).json(newObj);
  });

  app.put('/api/objectives/:id', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const isManagerOrAdmin = req.role?.id === 'role-admin' || req.role?.id === 'role-manager';
    if (!isManagerOrAdmin) {
      return res.status(403).json({ error: 'Chỉ quản lý hoặc admin mới được chỉnh sửa mục tiêu' });
    }

    const { id } = req.params;
    const { title, description, status } = req.body;

    const db = LocalDatabase.get();
    const idx = (db.objectives || []).findIndex(o => o.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Không tìm thấy mục tiêu' });
    }

    const obj = db.objectives![idx];
    if (title !== undefined) obj.title = title;
    if (description !== undefined) obj.description = description;
    
    if (status !== undefined && ['active', 'completed', 'cancelled'].includes(status)) {
      if (status === 'completed' && obj.status !== 'completed') {
        obj.completed_at = new Date().toISOString();
      } else if (status === 'active') {
        obj.completed_at = null;
      }
      obj.status = status as 'active' | 'completed' | 'cancelled';
    }

    obj.updated_at = new Date().toISOString();
    LocalDatabase.save(db);

    res.json(obj);
  });

  app.post('/api/objectives/:id/key-results', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const isManagerOrAdmin = req.role?.id === 'role-admin' || req.role?.id === 'role-manager';
    if (!isManagerOrAdmin) {
      return res.status(403).json({ error: 'Chỉ quản lý hoặc admin mới được thêm đầu việc' });
    }

    const { id } = req.params;
    const { title, assigned_department, assigned_to_user_id, notes } = req.body;

    if (!title || !assigned_department) {
      return res.status(400).json({ error: 'Thiếu tên đầu việc hoặc bộ phận được giao' });
    }

    const db = LocalDatabase.get();
    const objExists = (db.objectives || []).some(o => o.id === id);
    if (!objExists) {
      return res.status(404).json({ error: 'Mục tiêu không tồn tại' });
    }

    if (!db.objective_key_results) db.objective_key_results = [];

    const newKr: ObjectiveKeyResult = {
      id: 'kr-' + LocalDatabase.uuid(),
      objective_id: id,
      title,
      assigned_department,
      assigned_to_user_id: assigned_to_user_id || null,
      status: 'pending',
      progress: 0,
      notes: notes || null,
      updated_at: new Date().toISOString()
    };

    db.objective_key_results.push(newKr);
    
    const parentIdx = db.objectives!.findIndex(o => o.id === id);
    if (parentIdx !== -1) {
      db.objectives![parentIdx].updated_at = new Date().toISOString();
    }

    LocalDatabase.save(db);
    res.status(201).json(newKr);
  });

  app.post('/api/key-results/:id/progress', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { progress, comment } = req.body;

    if (progress === undefined || isNaN(Number(progress)) || Number(progress) < 0 || Number(progress) > 100) {
      return res.status(400).json({ error: 'Tiến độ phải là số từ 0 đến 100' });
    }

    const db = LocalDatabase.get();
    const krIdx = (db.objective_key_results || []).findIndex(k => k.id === id);
    if (krIdx === -1) {
      return res.status(404).json({ error: 'Không tìm thấy đầu việc của mục tiêu' });
    }

    const kr = db.objective_key_results![krIdx];
    const prevProgress = kr.progress;
    const nextProgress = Number(progress);

    kr.progress = nextProgress;
    if (nextProgress === 0) {
      kr.status = 'pending';
    } else if (nextProgress === 100) {
      kr.status = 'completed';
    } else {
      kr.status = 'in_progress';
    }
    kr.updated_at = new Date().toISOString();

    if (!db.objective_progress_updates) db.objective_progress_updates = [];
    const newLog: ObjectiveProgressUpdate = {
      id: 'kr-up-' + LocalDatabase.uuid(),
      key_result_id: id,
      updated_by: req.user!.id,
      progress_from: prevProgress,
      progress_to: nextProgress,
      comment: comment || null,
      created_at: new Date().toISOString()
    };
    db.objective_progress_updates.push(newLog);

    const parentIdx = (db.objectives || []).findIndex(o => o.id === kr.objective_id);
    if (parentIdx !== -1) {
      const parentObj = db.objectives![parentIdx];
      parentObj.updated_at = new Date().toISOString();

      const sisterKrs = db.objective_key_results!.filter(k => k.objective_id === parentObj.id);
      const allCompleted = sisterKrs.length > 0 && sisterKrs.every(k => k.progress === 100);
      
      if (allCompleted && parentObj.status === 'active') {
        parentObj.status = 'completed';
        parentObj.completed_at = new Date().toISOString();
      }
    }

    LocalDatabase.save(db);
    res.json({ key_result: kr, update_log: newLog });
  });

  app.post('/api/key-results/:id/push', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const isManagerOrAdmin = req.role?.id === 'role-admin' || req.role?.id === 'role-manager';
    if (!isManagerOrAdmin) {
      return res.status(403).json({ error: 'Chỉ quản lý hoặc admin mới được gửi yêu cầu đôn đốc' });
    }

    const { id } = req.params;
    const { action_type, comment } = req.body; // action_type: 'urge' | 'request_update'

    const db = LocalDatabase.get();
    const krIdx = (db.objective_key_results || []).findIndex(k => k.id === id);
    if (krIdx === -1) {
      return res.status(404).json({ error: 'Không tìm thấy đầu việc của mục tiêu' });
    }

    const kr = db.objective_key_results![krIdx];
    const objective = (db.objectives || []).find(o => o.id === kr.objective_id);
    const objectiveTitle = objective ? objective.title : 'mục tiêu lớn';

    // 1. Log in objective_progress_updates as a notice/comment
    const logComment = comment || (action_type === 'request_update' 
      ? `[Yêu cầu cập nhật] Quản lý yêu cầu báo cáo tiến độ công việc.` 
      : `[Đôn đốc tiến độ] Quản lý thúc giục đẩy nhanh tiến độ thực hiện.`);

    if (!db.objective_progress_updates) db.objective_progress_updates = [];
    const newLog: ObjectiveProgressUpdate = {
      id: 'kr-up-' + LocalDatabase.uuid(),
      key_result_id: id,
      updated_by: req.user!.id,
      progress_from: kr.progress,
      progress_to: kr.progress,
      comment: logComment,
      created_at: new Date().toISOString()
    };
    db.objective_progress_updates.push(newLog);

    // 2. Create target-specific system notification for the assigned staff member
    if (kr.assigned_to_user_id) {
      if (!db.notifications) db.notifications = [];
      db.notifications.push({
        id: 'notif-' + LocalDatabase.uuid(),
        sender_id: req.user!.id,
        receiver_id: kr.assigned_to_user_id,
        title: action_type === 'request_update' ? 'Yêu cầu báo cáo tiến độ' : 'Thúc giục tiến độ công việc',
        content: comment || `Quản lý ${req.user!.full_name} yêu cầu cập nhật tiến độ cho công việc "${kr.title}" thuộc mục tiêu "${objectiveTitle}".`,
        type: 'task_assignment',
        related_id: kr.id,
        is_read_by: [],
        created_at: new Date().toISOString()
      });
    }

    LocalDatabase.save(db);
    res.json({ success: true, key_result: kr, update_log: newLog });
  });

  app.get('/api/key-results/:id/updates', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const db = LocalDatabase.get();
    const updates = (db.objective_progress_updates || []).filter(up => up.key_result_id === id);
    
    const result = updates.map(up => {
      const user = db.users.find(u => u.id === up.updated_by);
      return {
        ...up,
        updated_by_name: user ? user.full_name : 'Nhân viên'
      };
    }).sort((a, b) => b.created_at.localeCompare(a.created_at));

    res.json(result);
  });

  app.get('/api/objectives/:id/report', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const db = LocalDatabase.get();
    
    const objective = (db.objectives || []).find(o => o.id === id);
    if (!objective) {
      return res.status(404).json({ error: 'Mục tiêu không tồn tại' });
    }

    const krs = (db.objective_key_results || []).filter(k => k.objective_id === id);
    const krIds = krs.map(k => k.id);
    const updates = (db.objective_progress_updates || []).filter(up => krIds.includes(up.key_result_id));

    const involvedUserIds = new Set<string>();
    krs.forEach(k => {
      if (k.assigned_to_user_id) involvedUserIds.add(k.assigned_to_user_id);
    });
    updates.forEach(up => {
      involvedUserIds.add(up.updated_by);
    });

    const involvedUsers = Array.from(involvedUserIds).map(uid => {
      const u = db.users.find(user => user.id === uid);
      return {
        id: uid,
        full_name: u ? u.full_name : 'N/A',
        email: u ? u.email : 'N/A'
      };
    });

    const timeline = updates.map(up => {
      const user = db.users.find(u => u.id === up.updated_by);
      const kr = krs.find(k => k.id === up.key_result_id);
      return {
        id: up.id,
        key_result_title: kr ? kr.title : 'Đầu việc',
        updated_by_name: user ? user.full_name : 'Nhân viên',
        progress_from: up.progress_from,
        progress_to: up.progress_to,
        comment: up.comment,
        created_at: up.created_at
      };
    }).sort((a, b) => b.created_at.localeCompare(a.created_at));

    res.json({
      objective,
      key_results: krs,
      involved_users: involvedUsers,
      timeline
    });
  });

  // ----------------- NOTIFICATIONS ENDPOINTS -----------------
  app.get('/api/notifications', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const db = LocalDatabase.get();
    const userId = req.user!.id;
    
    // Return notifications for this user (either receiver_id is this user, or it is null/global)
    const list = (db.notifications || []).filter(n => n.receiver_id === null || n.receiver_id === userId);
    
    const result = list.map(n => {
      const sender = db.users.find(u => u.id === n.sender_id);
      return {
        ...n,
        sender_name: sender ? sender.full_name : 'Hệ thống',
        is_read: n.is_read_by.includes(userId)
      };
    }).sort((a, b) => b.created_at.localeCompare(a.created_at));

    res.json(result);
  });

  app.post('/api/notifications', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const isManagerOrAdmin = req.role?.id === 'role-admin' || req.role?.id === 'role-manager';
    if (!isManagerOrAdmin) {
      return res.status(403).json({ error: 'Chỉ quản lý hoặc admin mới có quyền tạo thông báo chung' });
    }

    const { title, content } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'Thiếu tiêu đề hoặc nội dung thông báo' });
    }

    const db = LocalDatabase.get();
    if (!db.notifications) db.notifications = [];

    const newNotif: Notification = {
      id: 'notif-' + LocalDatabase.uuid(),
      sender_id: req.user!.id,
      receiver_id: null, // Global announcement
      title,
      content,
      type: 'general',
      related_id: null,
      is_read_by: [],
      created_at: new Date().toISOString()
    };

    db.notifications.push(newNotif);
    LocalDatabase.save(db);

    res.status(201).json(newNotif);
  });

  app.post('/api/notifications/read-all', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const db = LocalDatabase.get();
    const userId = req.user!.id;
    
    if (db.notifications) {
      db.notifications.forEach(n => {
        if ((n.receiver_id === null || n.receiver_id === userId) && !n.is_read_by.includes(userId)) {
          n.is_read_by.push(userId);
        }
      });
      LocalDatabase.save(db);
    }

    res.json({ success: true });
  });

  app.post('/api/notifications/:id/read', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const db = LocalDatabase.get();
    const userId = req.user!.id;
    const { id } = req.params;

    const notif = (db.notifications || []).find(n => n.id === id);
    if (!notif) {
      return res.status(404).json({ error: 'Không tìm thấy thông báo' });
    }

    if (notif.receiver_id !== null && notif.receiver_id !== userId) {
      return res.status(403).json({ error: 'Bạn không có quyền đọc thông báo này' });
    }

    if (!notif.is_read_by.includes(userId)) {
      notif.is_read_by.push(userId);
      LocalDatabase.save(db);
    }

    res.json({ success: true });
  });

  // ----------------- CHAT ENDPOINTS -----------------
  app.get('/api/chat/dashboard-messages', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const db = LocalDatabase.get();
    const userId = req.user!.id;
    const messages = db.chat_messages || [];

    // Filter messages where receiver_id is null (general chat) OR receiver_id is the current user
    const receivedMessages = messages.filter(m => m.receiver_id === null || m.receiver_id === userId);

    // Sort by newest first
    const sorted = [...receivedMessages].sort((a, b) => b.created_at.localeCompare(a.created_at));

    // Take the 10 newest
    const slice = sorted.slice(0, 10);

    const result = slice.map(m => {
      const sender = db.users.find(u => u.id === m.sender_id);
      return {
        ...m,
        sender_name: sender ? sender.full_name : 'Nhân viên',
        sender_role_id: sender ? sender.role_id : '',
        sender_role_name: sender ? db.roles.find(r => r.id === sender.role_id)?.name : 'staff'
      };
    });

    res.json(result);
  });

  app.get('/api/chat/messages', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const db = LocalDatabase.get();
    const userId = req.user!.id;
    const targetUserId = req.query.receiver_id === 'null' || !req.query.receiver_id ? null : req.query.receiver_id as string;

    const messages = db.chat_messages || [];

    let filtered = [];
    if (targetUserId === null) {
      // General group chat
      filtered = messages.filter(m => m.receiver_id === null);
    } else {
      // Private chat between userId and targetUserId
      filtered = messages.filter(m => 
        (m.sender_id === userId && m.receiver_id === targetUserId) ||
        (m.sender_id === targetUserId && m.receiver_id === userId)
      );
    }

    const result = filtered.map(m => {
      const sender = db.users.find(u => u.id === m.sender_id);
      return {
        ...m,
        sender_name: sender ? sender.full_name : 'Nhân viên',
        sender_role_id: sender ? sender.role_id : ''
      };
    }).sort((a, b) => a.created_at.localeCompare(b.created_at)); // Chronological order for chat history

    res.json(result);
  });

  app.post('/api/chat/messages', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const { receiver_id, content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Nội dung tin nhắn không được để trống' });
    }

    const targetUserId = receiver_id === 'null' || !receiver_id ? null : receiver_id as string;

    const db = LocalDatabase.get();
    if (!db.chat_messages) db.chat_messages = [];

    const newMsg: ChatMessage = {
      id: 'msg-' + LocalDatabase.uuid(),
      sender_id: req.user!.id,
      receiver_id: targetUserId,
      content: content.trim(),
      created_at: new Date().toISOString()
    };

    db.chat_messages.push(newMsg);
    LocalDatabase.save(db);

    const sender = db.users.find(u => u.id === req.user!.id);
    res.status(201).json({
      ...newMsg,
      sender_name: sender ? sender.full_name : 'Nhân viên',
      sender_role_id: sender ? sender.role_id : ''
    });
  });

  // ----------------- STUDIO SETTINGS ENDPOINTS -----------------
  app.get('/api/studio/settings', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const db = LocalDatabase.get();
    res.json(db.studio_settings || {});
  });

  app.put('/api/studio/settings', authenticate, requirePermission('users.manage'), (req: AuthenticatedRequest, res: Response) => {
    const db = LocalDatabase.get();
    const { name, phone, email, address, website, opening_hours, notes, backup_schedule } = req.body;

    if (!name || !phone || !email || !address) {
      return res.status(400).json({ error: 'Các trường Tên, Số điện thoại, Email và Địa chỉ không được để trống' });
    }

    db.studio_settings = {
      name,
      phone,
      email,
      address,
      website: website || '',
      opening_hours: opening_hours || '',
      notes: notes || '',
      backup_schedule: backup_schedule || 'weekly',
      last_backup_time: db.studio_settings?.last_backup_time || ''
    };

    LocalDatabase.save(db);
    res.json(db.studio_settings);
  });

  // ----------------- DATABASE MANAGEMENT ENDPOINTS -----------------
  // Export entire database as JSON file download
  app.get('/api/database/export', authenticate, requirePermission('users.manage'), (req: AuthenticatedRequest, res: Response) => {
    const db = LocalDatabase.get();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=aura_bridal_database.json');
    res.send(JSON.stringify(db, null, 2));
  });

  // Import / Restore database from uploaded JSON
  app.post('/api/database/import', authenticate, requirePermission('users.manage'), (req: AuthenticatedRequest, res: Response) => {
    const importedDb = req.body;
    
    // Minimal validation
    if (!importedDb || !Array.isArray(importedDb.users) || !Array.isArray(importedDb.roles)) {
      return res.status(400).json({ error: 'Định dạng file import không đúng. Phải chứa danh sách users và roles hợp lệ.' });
    }

    // Keep current backup log history and studio settings if they aren't provided
    const currentDb = LocalDatabase.get();
    if (!importedDb.backups) importedDb.backups = currentDb.backups || [];
    if (!importedDb.studio_settings) importedDb.studio_settings = currentDb.studio_settings;

    LocalDatabase.save(importedDb);
    res.json({ success: true, message: 'Nhập dữ liệu thành công!' });
  });

  // List backup history
  app.get('/api/database/backups', authenticate, requirePermission('users.manage'), (req: AuthenticatedRequest, res: Response) => {
    const db = LocalDatabase.get();
    res.json(db.backups || []);
  });

  // Trigger manual or scheduled backup creation
  app.post('/api/database/backups/create', authenticate, requirePermission('users.manage'), (req: AuthenticatedRequest, res: Response) => {
    const db = LocalDatabase.get();
    const { trigger_type } = req.body; // 'manual' or 'scheduled'

    try {
      const backupsDir = path.join(process.cwd(), 'backups');
      if (!fs.existsSync(backupsDir)) {
        fs.mkdirSync(backupsDir, { recursive: true });
      }

      const backupId = 'bak-' + LocalDatabase.uuid();
      const filename = `backup_${Date.now()}_${backupId}.json`;
      const backupPath = path.join(backupsDir, filename);
      const dbFile = path.join(process.cwd(), 'db.json');

      if (!fs.existsSync(dbFile)) {
        return res.status(500).json({ error: 'Không tìm thấy file cơ sở dữ liệu gốc để sao lưu' });
      }

      fs.copyFileSync(dbFile, backupPath);
      const stats = fs.statSync(backupPath);

      const newBackup = {
        id: backupId,
        filename,
        created_at: new Date().toISOString(),
        size_bytes: stats.size,
        trigger_type: trigger_type || 'manual',
        status: 'success' as const
      };

      if (!db.backups) db.backups = [];
      db.backups.push(newBackup);

      if (db.studio_settings) {
        db.studio_settings.last_backup_time = newBackup.created_at;
      }

      LocalDatabase.save(db);
      res.status(201).json(newBackup);
    } catch (err: any) {
      console.error('Backup creation error:', err);
      res.status(500).json({ error: `Không thể tạo bản sao lưu: ${err.message}` });
    }
  });

  // Restore database from specific backup ID
  app.post('/api/database/backups/restore/:id', authenticate, requirePermission('users.manage'), (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const db = LocalDatabase.get();
    const backup = db.backups?.find(b => b.id === id);

    if (!backup) {
      return res.status(404).json({ error: 'Không tìm thấy bản sao lưu được chọn' });
    }

    const backupsDir = path.join(process.cwd(), 'backups');
    const backupPath = path.join(backupsDir, backup.filename);

    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ error: 'File backup vật lý đã bị xóa hoặc không tìm thấy trên ổ đĩa' });
    }

    try {
      const backupRaw = fs.readFileSync(backupPath, 'utf-8');
      const backupData = JSON.parse(backupRaw);

      if (!backupData || !Array.isArray(backupData.users) || !Array.isArray(backupData.roles)) {
        return res.status(400).json({ error: 'File backup bị lỗi định dạng hoặc thiếu trường dữ liệu cốt lõi.' });
      }

      // Preserve current backup history
      backupData.backups = db.backups || [];
      LocalDatabase.save(backupData);

      res.json({ success: true, message: 'Khôi phục cơ sở dữ liệu thành công!' });
    } catch (err: any) {
      console.error('Restore error:', err);
      res.status(500).json({ error: `Lỗi khôi phục: ${err.message}` });
    }
  });

  // Delete specific backup
  app.delete('/api/database/backups/:id', authenticate, requirePermission('users.manage'), (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const db = LocalDatabase.get();
    const backupIndex = db.backups?.findIndex(b => b.id === id) ?? -1;

    if (backupIndex === -1) {
      return res.status(404).json({ error: 'Không tìm thấy bản sao lưu này' });
    }

    const backup = db.backups![backupIndex];
    const backupsDir = path.join(process.cwd(), 'backups');
    const backupPath = path.join(backupsDir, backup.filename);

    try {
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
      }
    } catch (err) {
      console.error('Failed to delete physical backup file:', err);
    }

    db.backups!.splice(backupIndex, 1);
    LocalDatabase.save(db);
    res.json({ success: true, message: 'Đã xóa bản sao lưu thành công' });
  });

  // ----------------- LEADS (CRM) ENDPOINTS -----------------
  app.get('/api/leads', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const hasViewAll = req.role?.permissions.includes('leads.view_all') || req.role?.permissions.includes('admin') || req.role?.id === 'role-admin';
    const hasManage = req.role?.permissions.includes('leads.manage');
    
    if (!hasViewAll && !hasManage) {
      return res.status(403).json({ error: 'Forbidden: Missing permission to view leads' });
    }

    const db = LocalDatabase.get();
    res.json(db.leads || []);
  });

  app.post('/api/leads', authenticate, requirePermission('leads.manage'), (req: AuthenticatedRequest, res: Response) => {
    const { customer_name, phone, source, interested_packages, sales_step, notes, support_needed } = req.body;
    if (!customer_name || !source) {
      return res.status(400).json({ error: 'Thiếu tên khách hàng hoặc nguồn tiếp cận' });
    }

    const db = LocalDatabase.get();
    const newLead: Lead = {
      id: 'lead-' + LocalDatabase.uuid(),
      date: new Date().toISOString().split('T')[0],
      customer_name,
      phone: phone || null,
      source,
      interested_packages: {
        beauty: !!interested_packages?.beauty,
        family: !!interested_packages?.family,
        wedding: !!interested_packages?.wedding,
        combo: !!interested_packages?.combo,
        couple: !!interested_packages?.couple
      },
      sales_step: sales_step || 1,
      follow_up_status: {
        follow_1: false,
        follow_2: false,
        follow_3: false
      },
      status: 'consulting',
      revenue: null,
      success_reason: null,
      failure_reason: null,
      assigned_sale_id: req.user!.id,
      support_needed: support_needed || null,
      notes: notes || null,
      admin_feedbacks: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (!db.leads) db.leads = [];
    db.leads.push(newLead);
    LocalDatabase.save(db);

    res.status(201).json(newLead);
  });

  app.put('/api/leads/:id', authenticate, requirePermission('leads.manage'), (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { 
      customer_name, phone, source, interested_packages, 
      sales_step, follow_up_status, status, revenue, 
      success_reason, failure_reason, notes, support_needed 
    } = req.body;

    const db = LocalDatabase.get();
    if (!db.leads) db.leads = [];
    const idx = db.leads.findIndex(l => l.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Không tìm thấy thông tin tư vấn' });
    }

    const prevStatus = db.leads[idx].status;

    if (customer_name !== undefined) db.leads[idx].customer_name = customer_name;
    if (phone !== undefined) db.leads[idx].phone = phone;
    if (source !== undefined) db.leads[idx].source = source;
    if (interested_packages !== undefined) {
      db.leads[idx].interested_packages = {
        beauty: !!interested_packages.beauty,
        family: !!interested_packages.family,
        wedding: !!interested_packages.wedding,
        combo: !!interested_packages.combo,
        couple: !!interested_packages.couple
      };
    }
    if (sales_step !== undefined) db.leads[idx].sales_step = sales_step;
    if (follow_up_status !== undefined) {
      db.leads[idx].follow_up_status = {
        follow_1: !!follow_up_status.follow_1,
        follow_2: !!follow_up_status.follow_2,
        follow_3: !!follow_up_status.follow_3
      };
    }
    if (status !== undefined) db.leads[idx].status = status;
    if (revenue !== undefined) db.leads[idx].revenue = revenue !== null ? parseFloat(revenue) : null;
    if (success_reason !== undefined) db.leads[idx].success_reason = success_reason;
    if (failure_reason !== undefined) db.leads[idx].failure_reason = failure_reason;
    if (notes !== undefined) db.leads[idx].notes = notes;
    if (support_needed !== undefined) db.leads[idx].support_needed = support_needed;
    
    db.leads[idx].updated_at = new Date().toISOString();

    if (status === 'won' && prevStatus !== 'won') {
      const lead = db.leads[idx];
      let custId = '';
      const existingCust = db.customers.find(c => c.phone === lead.phone && lead.phone);
      if (existingCust) {
        custId = existingCust.id;
      } else {
        const newCustId = 'cust-' + LocalDatabase.uuid();
        const newCust: Customer = {
          id: newCustId,
          full_name: lead.customer_name,
          phone: lead.phone || 'N/A',
          email: null,
          address: null,
          notes: lead.notes || 'Khách hàng tự động tạo từ tư vấn CRM.',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        db.customers.push(newCust);
        custId = newCustId;
      }

      let packageName = 'Gói Chụp Ảnh';
      if (lead.interested_packages.wedding) packageName = 'Gói Album cưới Wedding';
      else if (lead.interested_packages.family) packageName = 'Gói chụp ảnh gia đình Family';
      else if (lead.interested_packages.beauty) packageName = 'Gói chân dung nghệ thuật Beauty';
      else if (lead.interested_packages.combo) packageName = 'Gói chụp trọn gói Combo';
      else if (lead.interested_packages.couple) packageName = 'Gói chụp ảnh đôi Couple';

      const shootDate = new Date();
      shootDate.setDate(shootDate.getDate() + 30);
      const formattedShootDate = shootDate.toISOString().split('T')[0];

      const newOrderId = 'order-' + LocalDatabase.uuid();
      const newOrder: Order = {
        id: newOrderId,
        order_code: LocalDatabase.generateOrderCode(),
        customer_id: custId,
        status: 'new',
        shoot_date: formattedShootDate,
        shoot_time: '09:00',
        package_name: packageName,
        notes: lead.notes || 'Đơn hàng tự động khởi tạo từ tư vấn CRM.',
        created_by: req.user!.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      db.orders.push(newOrder);

      const history: OrderStatusHistory = {
        id: 'hist-' + LocalDatabase.uuid(),
        order_id: newOrder.id,
        from_status: '',
        to_status: 'new',
        changed_by: req.user!.id,
        note: 'Đơn hàng tự động tạo khi chốt tư vấn thành công',
        changed_at: new Date().toISOString()
      };
      db.order_status_history.push(history);

      const notifId = 'notif-' + LocalDatabase.uuid();
      db.notifications?.push({
        id: notifId,
        sender_id: req.user!.id,
        receiver_id: null,
        title: 'Hợp đồng mới từ tư vấn CRM',
        content: `Đơn hàng ${newOrder.order_code} của khách hàng ${lead.customer_name} đã được chốt thành công qua CRM.`,
        type: 'order_update',
        related_id: newOrderId,
        is_read_by: [],
        created_at: new Date().toISOString()
      });
    }

    LocalDatabase.save(db);
    res.json(db.leads[idx]);
  });

  app.post('/api/leads/:id/feedback', authenticate, requirePermission('leads.view_all'), (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'Nội dung phản hồi không được để trống' });
    }

    const db = LocalDatabase.get();
    if (!db.leads) db.leads = [];
    const idx = db.leads.findIndex(l => l.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Không tìm thấy thông tin tư vấn' });
    }

    const feedback: LeadFeedback = {
      id: 'fb-' + LocalDatabase.uuid(),
      user_id: req.user!.id,
      user_name: req.user!.full_name,
      content,
      created_at: new Date().toISOString()
    };

    db.leads[idx].admin_feedbacks.push(feedback);
    db.leads[idx].updated_at = new Date().toISOString();

    const assignedSaleId = db.leads[idx].assigned_sale_id;
    if (assignedSaleId !== req.user!.id) {
      db.notifications?.push({
        id: 'notif-' + LocalDatabase.uuid(),
        sender_id: req.user!.id,
        receiver_id: assignedSaleId,
        title: 'Phản hồi mới từ Quản trị viên',
        content: `Quản trị viên đã phản hồi trên khách hàng ${db.leads[idx].customer_name}: "${content.substring(0, 40)}${content.length > 40 ? '...' : ''}"`,
        type: 'general',
        related_id: id,
        is_read_by: [],
        created_at: new Date().toISOString()
      });
    }

    LocalDatabase.save(db);
    res.status(201).json(feedback);
  });

  app.get('/api/leads/analytics', authenticate, requirePermission('leads.view_all'), (req: AuthenticatedRequest, res: Response) => {
    const db = LocalDatabase.get();
    const leads = db.leads || [];

    const totalLeads = leads.length;
    const wonLeads = leads.filter(l => l.status === 'won').length;
    const lostLeads = leads.filter(l => l.status === 'lost').length;
    const activeLeads = totalLeads - wonLeads - lostLeads;

    const totalRevenue = leads.reduce((sum, l) => sum + (l.revenue || 0), 0);

    const sources: { [key: string]: number } = {};
    leads.forEach(l => {
      sources[l.source] = (sources[l.source] || 0) + 1;
    });

    const packages = {
      beauty: leads.filter(l => l.interested_packages.beauty).length,
      family: leads.filter(l => l.interested_packages.family).length,
      wedding: leads.filter(l => l.interested_packages.wedding).length,
      combo: leads.filter(l => l.interested_packages.combo).length,
      couple: leads.filter(l => l.interested_packages.couple).length
    };

    const failureReasons: { [key: string]: number } = {};
    leads.filter(l => l.failure_reason).forEach(l => {
      const r = l.failure_reason!;
      failureReasons[r] = (failureReasons[r] || 0) + 1;
    });

    const steps: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    leads.filter(l => l.status === 'consulting').forEach(l => {
      steps[l.sales_step] = (steps[l.sales_step] || 0) + 1;
    });

    res.json({
      summary: {
        totalLeads,
        wonLeads,
        lostLeads,
        activeLeads,
        totalRevenue,
        conversionRate: totalLeads > 0 ? (wonLeads / totalLeads) * 100 : 0
      },
      sources,
      packages,
      failureReasons,
      steps
    });
  });

  // ----------------- VITE DEVELOPMENT / STATIC PROD SERVING -----------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
