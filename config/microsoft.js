// server/config.js

// ID của ứng dụng React (Client ID)
const CLIENT_ID = "af6bdf14-30af-4652-91ec-eb6795aaaeb4"; 
// ID Tenant của trường bạn
const TENANT_ID = "2a2722ed-336b-40de-908f-ff6018831c79";

// Cấu hình xác minh token (Validation)
export const tokenValidationConfig = {
    // Issuer (Nhà phát hành): Địa chỉ này xác nhận token được cấp từ ai (Microsoft)
    issuer: `https://login.microsoftonline.com/${TENANT_ID}/v2.0`, 
    
    // Audience (Đối tượng): Token phải được phát hành cho Client ID này
    audience: CLIENT_ID, 
    
    // JwksUri: Địa chỉ để tải khóa công khai từ Microsoft để xác minh chữ ký token
    jwksUri: `https://login.microsoftonline.com/${TENANT_ID}/discovery/v2.0/keys` 
};