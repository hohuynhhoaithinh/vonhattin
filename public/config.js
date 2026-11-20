// Cấu hình EmailJS. Các giá trị này nằm trong code web nên ai cũng xem được,
// đó là cách EmailJS hoạt động (không phải mật khẩu). Cách lấy từng giá trị: xem README.md.
window.EMAILJS_CONFIG = {
  publicKey: '',        // EmailJS > Account > General > Public Key
  serviceId: '',        // EmailJS > Email Services > Service ID (dịch vụ Gmail bạn đã nối)
  ownerTemplateId: '',  // ID template "báo cho bạn" (owner.html)
  guestTemplateId: '',  // ID template "gửi người điền" (guest.html)
  ownerEmail: '',       // Email của bạn, người điền bấm Trả lời sẽ gửi về đây
};
