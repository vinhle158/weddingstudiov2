import { LocalDatabase } from './src/db_service';

async function seedMockData() {
  console.log('Khởi chạy tiến trình nạp dữ liệu Mockup dung lượng lớn...');
  
  // Khởi tạo LocalDatabase để kết nối DB
  await LocalDatabase.initialize();
  
  const db = LocalDatabase.get();

  // 1. NẠP KHÁCH HÀNG (CUSTOMERS - 8 CẶP ĐÔI)
  db.customers = [
    {
      id: "cust-1",
      full_name: "Hoàng Anh Tuấn & Lê Thu Hà",
      phone: "0912111222",
      email: "tuan.ha@gmail.com",
      address: "72 Nguyễn Trãi, Thanh Xuân, Hà Nội",
      notes: "Cặp đôi thích phong cách chụp tự nhiên Hàn Quốc, nhẹ nhàng.",
      created_at: "2026-06-10T10:00:00.000Z",
      updated_at: "2026-06-10T10:00:00.000Z"
    },
    {
      id: "cust-2",
      full_name: "Phạm Quốc Bảo & Ngô Khánh Vy",
      phone: "0983444555",
      email: "bao.vy@gmail.com",
      address: "Vinhomes Grand Park, Quận 9, TP. HCM",
      notes: "Cô dâu chú rể thích chụp ngoại cảnh Đà Lạt. Đặt gói cưới luxury VIP.",
      created_at: "2026-06-15T11:00:00.000Z",
      updated_at: "2026-06-15T11:00:00.000Z"
    },
    {
      id: "cust-3",
      full_name: "Nguyễn Minh Triết & Trần Hồng Hạnh",
      phone: "0909555666",
      email: "triet.hanh@yahoo.com",
      address: "Saigon Pearl, Bình Thạnh, TP. HCM",
      notes: "Chụp tại phim trường L'amour trọn gói. Đã đặt cọc và hẹn lịch chụp.",
      created_at: "2026-06-20T09:30:00.000Z",
      updated_at: "2026-06-20T09:30:00.000Z"
    },
    {
      id: "cust-4",
      full_name: "Đỗ Hữu Duy & Vũ Hoàng Yến",
      phone: "0977888999",
      email: "duy.yen@outlook.com",
      address: "Mỹ Đình 2, Nam Từ Liêm, Hà Nội",
      notes: "Khách thuê váy cưới luxury Elie Saab chụp tiệc cưới tại nhà hàng.",
      created_at: "2026-06-25T14:15:00.000Z",
      updated_at: "2026-06-25T14:15:00.000Z"
    },
    {
      id: "cust-5",
      full_name: "Trần Anh Đức & Nguyễn Mai Chi",
      phone: "0945888999",
      email: "duc.chi@gmail.com",
      address: "Vinhomes Riverside, Long Biên, Hà Nội",
      notes: "Thuê váy thiết kế luxury + quay phim phóng sự đám hỏi ngày cưới.",
      created_at: "2026-06-26T10:00:00.000Z",
      updated_at: "2026-06-26T10:00:00.000Z"
    },
    {
      id: "cust-6",
      full_name: "Lâm Thế Vinh & Phan Kim Oanh",
      phone: "0932666777",
      email: "vinh.oanh@outlook.com",
      address: "Đất Thánh, Tân Bình, TP. HCM",
      notes: "Gói Album Studio Concept Hàn Quốc tối giản. Lên lịch chụp 20/07.",
      created_at: "2026-06-28T09:00:00.000Z",
      updated_at: "2026-06-28T09:00:00.000Z"
    },
    {
      id: "cust-7",
      full_name: "Dương Minh Khang & Triệu Vy",
      phone: "0915333444",
      email: "khang.vy@gmail.com",
      address: "Thảo Điền, Quận 2, TP. HCM",
      notes: "Trọn gói cưới Diamond cao cấp, chụp pre-wedding Nha Trang + 2 ngày lễ cưới tiệc.",
      created_at: "2026-06-30T15:30:00.000Z",
      updated_at: "2026-06-30T15:30:00.000Z"
    },
    {
      id: "cust-8",
      full_name: "Nguyễn Việt Tiến & Đặng Thảo Vân",
      phone: "0981999222",
      email: "tien.van@yahoo.com",
      address: "Cầu Giấy, Hà Nội",
      notes: "Chụp Album ngoại cảnh Ba Vì mùa thu hoa dã quỳ. Yêu cầu thợ ảnh cứng.",
      created_at: "2026-07-02T11:00:00.000Z",
      updated_at: "2026-07-02T11:00:00.000Z"
    }
  ];

  // 2. NẠP HỢP ĐỒNG & ĐƠN HÀNG (ORDERS - 8 HỢP ĐỒNG LỚN)
  db.orders = [
    {
      id: "order-1",
      order_code: "HĐ-2026-0001",
      customer_id: "cust-1",
      status: "delivered",
      shoot_date: "2026-06-28",
      shoot_time: "08:00",
      package_name: "Gói Album Phim Trường Premium",
      package_price: 18000000,
      deposit_amount: 10000000,
      total_amount: 18000000,
      notes: "Đã chụp xong, quyết toán và bàn giao album hoàn thiện.",
      created_by: "user-admin",
      created_at: "2026-06-10T10:15:00.000Z",
      updated_at: "2026-06-28T18:00:00.000Z"
    },
    {
      id: "order-2",
      order_code: "HĐ-2026-0002",
      customer_id: "cust-2",
      status: "shooting",
      shoot_date: "2026-07-15",
      shoot_time: "07:00",
      package_name: "Trọn gói Pre-wedding Đà Lạt & Ngày Cưới Luxury",
      package_price: 45000000,
      deposit_amount: 20000000,
      total_amount: 45000000,
      notes: "Đã thanh toán đợt 2 (thêm 15 triệu). Đi chụp tại Đà Lạt ngày 15/07.",
      created_by: "user-admin",
      created_at: "2026-06-15T11:20:00.000Z",
      updated_at: "2026-07-01T15:00:00.000Z"
    },
    {
      id: "order-3",
      order_code: "HĐ-2026-0003",
      customer_id: "cust-3",
      status: "confirmed",
      shoot_date: "2026-07-22",
      shoot_time: "09:00",
      package_name: "Trọn gói Album Phim trường L'amour",
      package_price: 15000000,
      deposit_amount: 5000000,
      total_amount: 15000000,
      notes: "Mới đặt cọc đợt 1. Thống nhất lịch chụp ngày 22/07.",
      created_by: "user-sale",
      created_at: "2026-06-20T10:00:00.000Z",
      updated_at: "2026-06-20T10:00:00.000Z"
    },
    {
      id: "order-4",
      order_code: "HĐ-2026-0004",
      customer_id: "cust-4",
      status: "confirmed",
      shoot_date: "2026-08-02",
      shoot_time: "17:00",
      package_name: "Thuê Váy Cưới Luxury Elie Saab VIP",
      package_price: 12000000,
      deposit_amount: 4000000,
      total_amount: 12000000,
      notes: "Cô dâu đã thử váy và cọc đợt 1. Nhận váy ngày 01/08, trả váy ngày 03/08.",
      created_by: "user-sale",
      created_at: "2026-06-25T14:30:00.000Z",
      updated_at: "2026-06-25T14:30:00.000Z"
    },
    {
      id: "order-5",
      order_code: "HĐ-2026-0005",
      customer_id: "cust-5",
      status: "delivered",
      shoot_date: "2026-07-02",
      shoot_time: "07:30",
      package_name: "Quay phim Phóng sự cưới Gold & Váy thiết kế",
      package_price: 22000000,
      deposit_amount: 10000000,
      total_amount: 22000000,
      notes: "Đã hoàn thành bàn giao đầy đủ file video phóng sự đám hỏi.",
      created_by: "user-admin",
      created_at: "2026-06-26T10:15:00.000Z",
      updated_at: "2026-07-02T19:00:00.000Z"
    },
    {
      id: "order-6",
      order_code: "HĐ-2026-0006",
      customer_id: "cust-6",
      status: "confirmed",
      shoot_date: "2026-07-20",
      shoot_time: "08:30",
      package_name: "Concept Studio Hàn Quốc",
      package_price: 10000000,
      deposit_amount: 3000000,
      total_amount: 10000000,
      notes: "Đã nhận cọc và setup studio concept tối giản.",
      created_by: "user-sale",
      created_at: "2026-06-28T09:15:00.000Z",
      updated_at: "2026-06-28T09:15:00.000Z"
    },
    {
      id: "order-7",
      order_code: "HĐ-2026-0007",
      customer_id: "cust-7",
      status: "confirmed",
      shoot_date: "2026-07-25",
      shoot_time: "06:00",
      package_name: "Combo Wedding Day Diamond Full Service",
      package_price: 65000000,
      deposit_amount: 30000000,
      total_amount: 65000000,
      notes: "Hợp đồng lớn nhất quý. Chụp Nha Trang pre-wedding + quay phóng sự tiệc ngày cưới.",
      created_by: "user-admin",
      created_at: "2026-06-30T16:00:00.000Z",
      updated_at: "2026-06-30T16:00:00.000Z"
    },
    {
      id: "order-8",
      order_code: "HĐ-2026-0008",
      customer_id: "cust-8",
      status: "new",
      shoot_date: "2026-10-12",
      shoot_time: "06:30",
      package_name: "Album ngoại cảnh Ba Vì dã quỳ",
      package_price: 16000000,
      deposit_amount: 5000000,
      total_amount: 16000000,
      notes: "Mới ký cọc hôm nay. Lên kế hoạch đặt xe và thợ chụp.",
      created_by: "user-sale",
      created_at: "2026-07-02T11:20:00.000Z",
      updated_at: "2026-07-02T11:20:00.000Z"
    }
  ];

  // 3. NẠP LỊCH SỬ HỢP ĐỒNG (ORDER STATUS HISTORY)
  db.order_status_history = [
    {
      id: "osh-1",
      order_id: "order-1",
      from_status: "pending",
      to_status: "delivered",
      changed_by: "user-admin",
      note: "Bàn giao album trọn gói thành công cho khách hàng.",
      changed_at: "2026-06-28T18:00:00.000Z"
    },
    {
      id: "osh-2",
      order_id: "order-2",
      from_status: "pending",
      to_status: "shooting",
      changed_by: "user-admin",
      note: "Xác nhận chuyển thanh toán đợt 2. Setup thiết bị lên đường đi Đà Lạt.",
      changed_at: "2026-07-01T15:00:00.000Z"
    },
    {
      id: "osh-3",
      order_id: "order-5",
      from_status: "pending",
      to_status: "delivered",
      changed_by: "user-admin",
      note: "Bàn giao file quay phóng sự ăn hỏi xuất sắc.",
      changed_at: "2026-07-02T19:00:00.000Z"
    }
  ];

  // 4. NẠP PHÂN CÔNG CÔNG VIỆC (TASKS - 7 NHIỆM VỤ ĐIỀU PHỐI)
  db.tasks = [
    {
      id: "task-1",
      title: "Chuẩn bị trang phục đi Đà Lạt - Vy",
      description: "Là ủi váy và vest cưới, đóng thùng hành lý cho ekip đi Đà Lạt cho cô dâu Vy.",
      order_id: "order-2",
      assigned_to: "user-sale",
      assigned_by: "user-admin",
      status: "in_progress",
      priority: "high",
      due_date: "2026-07-13",
      created_at: "2026-07-01T15:10:00.000Z",
      updated_at: "2026-07-01T15:10:00.000Z"
    },
    {
      id: "task-2",
      title: "Thiết kế album layout - Tuấn & Hà",
      description: "Photoshop chỉnh sửa hình ảnh album phim trường 30x30 30 trang cho cặp đôi Tuấn & Hà.",
      order_id: "order-1",
      assigned_to: "user-admin",
      assigned_by: "user-admin",
      status: "done",
      priority: "normal",
      due_date: "2026-07-05",
      created_at: "2026-06-29T09:00:00.000Z",
      updated_at: "2026-07-05T17:30:00.000Z"
    },
    {
      id: "task-3",
      title: "Makeup thử cô dâu - Hạnh",
      description: "Hẹn cô dâu Hạnh qua studio makeup thử, tư vấn phong cách trang điểm cưới Hàn Quốc.",
      order_id: "order-3",
      assigned_to: "user-sale",
      assigned_by: "user-admin",
      status: "pending",
      priority: "normal",
      due_date: "2026-07-18",
      created_at: "2026-07-02T10:00:00.000Z",
      updated_at: "2026-07-02T10:00:00.000Z"
    },
    {
      id: "task-4",
      title: "Hậu kỳ video phóng sự cưới - Chi",
      description: "Edit phim ngắn phóng sự cưới ngày đám hỏi và gửi link duyệt demo cho cô dâu Chi.",
      order_id: "order-5",
      assigned_to: "user-admin",
      assigned_by: "user-admin",
      status: "done",
      priority: "high",
      due_date: "2026-07-03",
      created_at: "2026-06-28T09:00:00.000Z",
      updated_at: "2026-07-02T18:00:00.000Z"
    },
    {
      id: "task-5",
      title: "Giao váy thiết kế tiệc cưới - Yến",
      description: "Cô dâu Yến qua thử lại váy và mang đi ngày cưới. Nhận lại váy ngày 03/08.",
      order_id: "order-4",
      assigned_to: "user-sale",
      assigned_by: "user-admin",
      status: "in_progress",
      priority: "high",
      due_date: "2026-08-01",
      created_at: "2026-07-01T10:00:00.000Z",
      updated_at: "2026-07-01T10:00:00.000Z"
    },
    {
      id: "task-6",
      title: "Chuẩn bị hoa tươi và lịch xe cưới - Vy",
      description: "Đặt xe hoa cưới Mercedes trắng và chuẩn bị hoa cầm tay baby Hà Lan cho cô dâu Vy.",
      order_id: "order-7",
      assigned_to: "user-sale",
      assigned_by: "user-admin",
      status: "pending",
      priority: "high",
      due_date: "2026-07-28",
      created_at: "2026-07-04T11:00:00.000Z",
      updated_at: "2026-07-04T11:00:00.000Z"
    },
    {
      id: "task-7",
      title: "Hậu kỳ ảnh ngoại cảnh Ba Vì - Vân",
      description: "Photoshop 40 tấm ảnh cưới dã quỳ Ba Vì xuất sắc chuẩn bị làm khung ảnh lớn cổng cưới.",
      order_id: "order-8",
      assigned_to: "user-admin",
      assigned_by: "user-sale",
      status: "pending",
      priority: "normal",
      due_date: "2026-10-16",
      created_at: "2026-07-05T09:00:00.000Z",
      updated_at: "2026-07-05T09:00:00.000Z"
    }
  ];

  // 5. NẠP MỤC TIÊU OKRS (OBJECTIVES - 3 MỤC TIÊU CHIẾN LƯỢC)
  db.objectives = [
    {
      id: "obj-1",
      title: "Tăng trưởng Doanh số Quý 3/2026",
      description: "Đẩy mạnh doanh số ký mới từ các gói dịch vụ chụp ngoại cảnh và trọn gói VIP.",
      status: "active",
      created_by: "user-admin",
      created_at: "2026-07-01T00:00:00.000Z",
      updated_at: "2026-07-01T00:00:00.000Z",
      completed_at: null
    },
    {
      id: "obj-2",
      title: "Nâng cao chỉ số hài lòng của khách hàng (NPS)",
      description: "Tập trung tối ưu dịch vụ makeup, chăm sóc và bàn giao album đúng hẹn.",
      status: "active",
      created_by: "user-admin",
      created_at: "2026-07-01T00:00:00.000Z",
      updated_at: "2026-07-01T00:00:00.000Z",
      completed_at: null
    },
    {
      id: "obj-3",
      title: "Tối ưu hóa Thương hiệu trực tuyến",
      description: "Phát triển các kênh truyền thông tiếp cận tệp cô dâu trẻ chú rể GenZ.",
      status: "active",
      created_by: "user-admin",
      created_at: "2026-07-01T00:00:00.000Z",
      updated_at: "2026-07-01T00:00:00.000Z",
      completed_at: null
    }
  ];

  // 6. NẠP KẾT QUẢ THÀNH PHẦN OKRS (OBJECTIVE KEY RESULTS)
  db.objective_key_results = [
    {
      id: "kr-1",
      objective_id: "obj-1",
      title: "Đạt doanh số ký mới 500 triệu đồng",
      assigned_department: "Kinh doanh",
      assigned_to_user_id: "user-admin",
      status: "active",
      progress: 64,
      notes: "Hiện tại đã đạt 320 triệu từ 9 hợp đồng.",
      updated_at: "2026-07-06T15:00:00.000Z"
    },
    {
      id: "kr-2",
      objective_id: "obj-1",
      title: "Ký mới 5 hợp đồng trọn gói VIP Luxury (>40tr)",
      assigned_department: "Tư vấn",
      assigned_to_user_id: "user-sale",
      status: "active",
      progress: 60,
      notes: "Đã ký được 3 hợp đồng, còn 2 hợp đồng mục tiêu.",
      updated_at: "2026-07-06T15:00:00.000Z"
    },
    {
      id: "kr-3",
      objective_id: "obj-2",
      title: "Đạt tỷ lệ khách hàng đánh giá 5 sao > 95%",
      assigned_department: "Chăm sóc khách hàng",
      assigned_to_user_id: "user-sale",
      status: "active",
      progress: 92,
      notes: "Đang duy trì chất lượng phục vụ rất tốt từ đầu tháng.",
      updated_at: "2026-07-06T15:00:00.000Z"
    },
    {
      id: "kr-4",
      objective_id: "obj-3",
      title: "Đạt 20.000 lượt theo dõi trên TikTok Studio",
      assigned_department: "Tiếp thị trực tuyến",
      assigned_to_user_id: "user-admin",
      status: "active",
      progress: 80,
      notes: "Các video clip mẫu váy cưới thu hút nhiều bình luận cô dâu.",
      updated_at: "2026-07-06T15:00:00.000Z"
    },
    {
      id: "kr-5",
      objective_id: "obj-3",
      title: "Thu thập 150 lead tư vấn từ các kênh Social",
      assigned_department: "Tư vấn",
      assigned_to_user_id: "user-sale",
      status: "active",
      progress: 73,
      notes: "Đã có 110 khách hàng tiềm năng gửi tin nhắn xin báo giá.",
      updated_at: "2026-07-06T15:00:00.000Z"
    }
  ];

  // 7. NẠP KHÁCH HÀNG CRM (LEADS - PHÂN BỔ TRỌN VẸN 6 CỘT KANBAN)
  db.leads = [
    {
      id: "lead-dat",
      date: "2026-07-05",
      customer_name: "Nguyễn Tiến Đạt",
      phone: "0921555666",
      source: "ĐƯỢC GIỚI THIỆU",
      interested_packages: { beauty: false, family: false, wedding: true, combo: false, couple: false },
      sales_step: 1, // Tiếp cận
      follow_up_status: { follow_1: true, follow_2: false, follow_3: false },
      status: "consulting",
      revenue: null,
      success_reason: null,
      failure_reason: null,
      assigned_sale_id: "user-sale",
      support_needed: null,
      notes: "Bạn thân của khách cũ giới thiệu. Cọc trọn gói tiệc ngày cưới tháng 11.",
      admin_feedbacks: [],
      created_at: "2026-07-05T10:00:00.000Z",
      updated_at: "2026-07-05T10:00:00.000Z"
    },
    {
      id: "lead-1",
      date: "2026-07-02",
      customer_name: "Trần Bảo Ngọc",
      phone: "0934111222",
      source: "PAGE THE WILL",
      interested_packages: { beauty: false, family: false, wedding: true, combo: false, couple: false },
      sales_step: 2, // Tư vấn
      follow_up_status: { follow_1: true, follow_2: false, follow_3: false },
      status: "consulting",
      revenue: null,
      success_reason: null,
      failure_reason: null,
      assigned_sale_id: "user-sale",
      support_needed: "Khách muốn xem mẫu váy cưới đuôi cá thiết kế cao cấp.",
      notes: "Đã gửi báo giá gói L'amour. Khách phản hồi thích nhưng còn băn khoăn về chi phí makeup cô dâu.",
      admin_feedbacks: [],
      created_at: "2026-07-02T10:00:00.000Z",
      updated_at: "2026-07-02T11:00:00.000Z"
    },
    {
      id: "lead-2",
      date: "2026-07-04",
      customer_name: "Phạm Minh Hoàng",
      phone: "0903333444",
      source: "VÃNG LAI",
      interested_packages: { beauty: false, family: false, wedding: false, combo: true, couple: false },
      sales_step: 3, // Hẹn gặp
      follow_up_status: { follow_1: true, follow_2: true, follow_3: false },
      status: "consulting",
      revenue: null,
      success_reason: null,
      failure_reason: null,
      assigned_sale_id: "user-admin",
      support_needed: null,
      notes: "Khách trực tiếp đến xem showroom. Có thiện chí cao, hẹn cuối tuần dẫn hai bên gia đình đến đặt cọc gói Diamond.",
      admin_feedbacks: [],
      created_at: "2026-07-04T15:00:00.000Z",
      updated_at: "2026-07-04T16:00:00.000Z"
    },
    {
      id: "lead-3",
      date: "2026-07-05",
      customer_name: "Lê Mỹ Linh",
      phone: "0918777888",
      source: "KHÁCH CŨ",
      interested_packages: { beauty: false, family: true, wedding: false, combo: false, couple: false },
      sales_step: 4, // Lên lịch chụp/Gửi mẫu
      follow_up_status: { follow_1: true, follow_2: false, follow_3: false },
      status: "consulting",
      revenue: null,
      success_reason: null,
      failure_reason: null,
      assigned_sale_id: "user-sale",
      support_needed: null,
      notes: "Chụp kỷ niệm gia đình 5 người. Đã chốt lịch chụp ngày 19/07.",
      admin_feedbacks: [],
      created_at: "2026-07-05T09:00:00.000Z",
      updated_at: "2026-07-05T10:30:00.000Z"
    },
    {
      id: "lead-trang",
      date: "2026-07-06",
      customer_name: "Trịnh Thu Trang",
      phone: "0962333444",
      source: "PAGE FAMILY",
      interested_packages: { beauty: false, family: false, wedding: true, combo: false, couple: false },
      sales_step: 5, // Đàm phán
      follow_up_status: { follow_1: true, follow_2: true, follow_3: false },
      status: "consulting",
      revenue: null,
      success_reason: null,
      failure_reason: null,
      assigned_sale_id: "user-sale",
      support_needed: null,
      notes: "Khách đang phân vân giữa ngoại cảnh Nha Trang & Đà Lạt. Muốn bớt 10% hoặc tặng thêm gói quay flycam.",
      admin_feedbacks: [],
      created_at: "2026-07-06T08:00:00.000Z",
      updated_at: "2026-07-06T08:30:00.000Z"
    },
    {
      id: "lead-hung",
      date: "2026-07-04",
      customer_name: "Đặng Quốc Hưng",
      phone: "0971222333",
      source: "PAGE THE WILL",
      interested_packages: { beauty: false, family: false, wedding: true, combo: false, couple: false },
      sales_step: 6, // Kí hợp đồng
      follow_up_status: { follow_1: true, follow_2: true, follow_3: true },
      status: "won",
      revenue: 35000000,
      success_reason: "Chốt gói Phóng sự cưới Gold. Đã chuyển khoản đặt cọc đợt 1 thành công.",
      failure_reason: null,
      assigned_sale_id: "user-admin",
      support_needed: null,
      notes: "Hợp đồng đã chuyển cọc, tự động chuyển đổi thông tin sang phân hệ Đơn hàng.",
      admin_feedbacks: [],
      created_at: "2026-07-04T09:00:00.000Z",
      updated_at: "2026-07-04T11:00:00.000Z"
    },
    {
      id: "lead-nam-lost",
      date: "2026-07-01",
      customer_name: "Vũ Hoàng Nam",
      phone: "0904555111",
      source: "PAGE GARDEN",
      interested_packages: { beauty: false, family: false, wedding: true, combo: false, couple: false },
      sales_step: 3,
      follow_up_status: { follow_1: true, follow_2: false, follow_3: false },
      status: "lost",
      revenue: null,
      success_reason: null,
      failure_reason: "Ngân sách khách thấp, mong muốn dưới 10 triệu trọn gói.",
      assigned_sale_id: "user-sale",
      support_needed: null,
      notes: "Đã tư vấn gói studio concept nhưng khách vẫn muốn chụp ngoại cảnh giá rẻ. Không chốt được.",
      admin_feedbacks: [],
      created_at: "2026-07-01T14:00:00.000Z",
      updated_at: "2026-07-01T15:00:00.000Z"
    }
  ];

  // 8. NẠP TIN NHẮN CHAT NỘI BỘ (CHAT MESSAGES - THREAD ĐÀM THOẠI CHI TIẾT)
  db.chat_messages = [
    {
      id: "msg-1",
      sender_id: "user-sale",
      receiver_id: null,
      content: "Chào cả nhà, em vừa lên lịch chụp mới cho cô dâu Vy ngày 15/07 đi Đà Lạt nha. Makeup đã xếp chị Linh đi cùng rồi ạ.",
      created_at: "2026-07-06T10:00:00.000Z"
    },
    {
      id: "msg-2",
      sender_id: "user-admin",
      receiver_id: null,
      content: "Tốt lắm. Ekip chuẩn bị kỹ thiết bị và trang phục giữ ấm cho cô dâu chú rể nhé. Mùa này Đà Lạt tối khá lạnh.",
      created_at: "2026-07-06T10:15:00.000Z"
    },
    {
      id: "msg-3",
      sender_id: "user-sale",
      receiver_id: null,
      content: "Dạ anh. Em đã là ủi và đóng thùng váy cưới cẩn thận sẵn sàng rồi ạ. Gửi xe hoa đi cùng ekip sáng sớm.",
      created_at: "2026-07-06T10:20:00.000Z"
    },
    {
      id: "msg-4",
      sender_id: "user-admin",
      receiver_id: null,
      content: "Còn Album của Tuấn & Hà photoshop chỉnh sửa xong chưa Tuấn ơi? Khách có hỏi xem trước layout thiết kế.",
      created_at: "2026-07-06T10:30:00.000Z"
    },
    {
      id: "msg-5",
      sender_id: "user-admin",
      receiver_id: null,
      content: "Dạ em vừa gửi duyệt layout qua email rồi anh. Em đã sửa lại phần màu da sáng tự nhiên hơn theo đúng ý cô dâu.",
      created_at: "2026-07-06T10:35:00.000Z"
    },
    {
      id: "msg-6",
      sender_id: "user-sale",
      receiver_id: null,
      content: "Bên em mới chốt thêm gói tiệc cưới Diamond của cặp đôi Khang & Vy nữa ạ. Ngày chụp pre-wedding Nha Trang là 25/07, thợ chính gán anh Việt Hoàng nha.",
      created_at: "2026-07-06T10:45:00.000Z"
    }
  ];

  // LƯU VÀ ĐỒNG BỘ LÊN POSTGRES
  LocalDatabase.save(db);
  
  console.log('Nạp dữ liệu Mockup dung lượng lớn thành công!');
}

seedMockData().catch(err => {
  console.error('Lỗi khi nạp dữ liệu Mockup:', err);
});
