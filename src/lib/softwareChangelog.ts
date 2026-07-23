export type SoftwareReleaseStatus = 'verified' | 'testing';

export interface SoftwareRelease {
  id: string;
  date: string;
  summary: string;
  changes: string[];
  status: SoftwareReleaseStatus;
}

// Add new releases at the top. Use the next 3-digit ID: 002, 003, 004...
export const SOFTWARE_CHANGELOG: SoftwareRelease[] = [
  {
    id: '002',
    date: '2026-07-23',
    summary: 'Hoàn thiện điều hướng Dashboard và quản lý đơn hàng trên giao diện mobile.',
    changes: [
      'Cho phép nhấn vào các thẻ Đơn hoạt động, Doanh thu, Tiến độ công việc và Mục tiêu trên Dashboard để mở đúng nội dung liên quan.',
      'Thêm nút Ký hợp đồng mới trong phần Đơn hàng trên mobile.',
      'Đồng bộ biểu mẫu tạo hợp đồng trên mobile với đầy đủ gói chụp, thanh toán và ngày thanh toán.',
      'Đổi bộ lọc trạng thái đơn hàng sang danh sách chọn gọn, không còn tràn khỏi màn hình mobile.',
      'Bổ sung trạng thái Chưa có ngày chụp và toàn bộ quy trình xử lý đơn hàng vào bộ lọc mobile.'
    ],
    status: 'verified'
  },
  {
    id: '001',
    date: '2026-07-23',
    summary: 'Điều chỉnh hợp đồng, thanh toán, gói chụp, tiến độ công việc và giao diện sử dụng.',
    changes: [
      'Cho phép tạo hợp đồng khi khách hàng chưa chọn ngày chụp.',
      'Giờ chụp sử dụng định dạng 24 giờ.',
      'Ghi nhận người tạo hợp đồng là nhân viên liên quan đầu tiên.',
      'Cập nhật các bước theo dõi tiến độ xử lý hình ảnh.',
      'Thêm ba lần thanh toán, ngày thanh toán và lịch sử thu tiền.',
      'Thêm phần quản lý gói chụp và giá dành cho Admin.',
      'Giữ nguyên dữ liệu hợp đồng và tiền cọc đã có.',
      'Cố định thanh menu bên trái khi nội dung trang dài.'
    ],
    status: 'verified'
  }
];
