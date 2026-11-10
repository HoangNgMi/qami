// Routing Middleware — Basic Auth bảo vệ TOÀN BỘ site (kể cả data.js).
// Không có matcher => chạy trên MỌI request.
// Mật khẩu đặt ở Vercel: Project → Settings → Environment Variables:
//   BASIC_AUTH_USER = <tên đăng nhập>
//   BASIC_AUTH_PASS = <mật khẩu>
// Rồi Redeploy. Mở link sẽ bị hỏi user/pass.
import { next } from "@vercel/functions";

export default function middleware(request) {
  const USER = process.env.BASIC_AUTH_USER;
  const PASS = process.env.BASIC_AUTH_PASS;

  const deny = (msg) =>
    new Response(msg, {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="zen.agency - noi bo"' },
    });

  // Chưa đặt mật khẩu -> khoá cứng (an toàn mặc định)
  if (!USER || !PASS) return deny("Chua cau hinh BASIC_AUTH_USER / BASIC_AUTH_PASS tren Vercel.");

  const auth = request.headers.get("authorization") || "";
  const [scheme, encoded] = auth.split(" ");
  if (scheme === "Basic" && encoded) {
    const decoded = atob(encoded);
    const i = decoded.indexOf(":");
    if (decoded.slice(0, i) === USER && decoded.slice(i + 1) === PASS) {
      return next(); // đúng -> cho qua, phục vụ file tĩnh
    }
  }
  return deny("Can dang nhap de xem.");
}
