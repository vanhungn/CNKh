const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

// --- CẤU HÌNH ---
const TENANT_ID = "2a2722ed-336b-40de-908f-ff6018831c79";
const CLIENT_ID = "af6bdf14-30af-4652-91ec-eb6795aaaeb4";
const JWKS_URI = `https://login.microsoftonline.com/${TENANT_ID}/discovery/v2.0/keys`;

// Xác định môi trường
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// ✅ Cho phép nhiều issuer hợp lệ (tenant cụ thể + common)
const VALID_ISSUERS = [
    `https://login.microsoftonline.com/${TENANT_ID}/v2.0`,
    `https://login.microsoftonline.com/common/v2.0`,
    `https://sts.windows.net/${TENANT_ID}/` // backup cho v1 token
];

// ✅ SUPPORT cả 2 format của audience
const VALID_AUDIENCES = [
    CLIENT_ID,
    `api://${CLIENT_ID}`
];

// --- JWKS CLIENT ---
const client = jwksClient({
    jwksUri: JWKS_URI,
    cache: true,
    cacheMaxEntries: 5,
    cacheMaxAge: 600000,
    rateLimit: true,
    jwksRequestsPerMinute: 10
});

// --- LẤY KHÓA CÔNG KHAI ---
const getKey = (header, callback) => {
    if (!header.kid) {
        console.error("❌ Token thiếu 'kid' trong header");
        return callback(new Error('Token header thiếu kid'));
    }

    client.getSigningKey(header.kid, (err, key) => {
        if (err) {
            console.error("❌ LỖI TẢI JWKS:", {
                message: err.message,
                kid: header.kid,
                jwksUri: JWKS_URI
            });
            return callback(err);
        }

        const signingKey = key.getPublicKey();
        callback(null, signingKey);
    });
};

// --- XỬ LÝ LỖI ---
const handleJWTError = (err, res) => {
    console.error("❌ JWT Verification Error:", {
        name: err.name,
        message: err.message,
        timestamp: new Date().toISOString()
    });

    let statusCode = 401;
    let clientMessage = 'Unauthorized';

    if (err.name === 'TokenExpiredError') {
        clientMessage = IS_PRODUCTION
            ? 'Token expired'
            : `Token expired at ${err.expiredAt}`;
    } else if (err.name === 'JsonWebTokenError') {
        if (err.message.includes('invalid signature')) {
            clientMessage = 'Invalid token signature';
        } else if (err.message.includes('jwt malformed')) {
            clientMessage = 'Malformed token';
        } else {
            clientMessage = IS_PRODUCTION ? 'Invalid token' : err.message;
        }
    } else if (err.name === 'NotBeforeError') {
        clientMessage = 'Token not yet valid';
    } else {
        clientMessage = IS_PRODUCTION
            ? 'Authentication service unavailable'
            : err.message;
        statusCode = 503;
    }

    return res.status(statusCode).json({
        error: clientMessage,
        ...(IS_PRODUCTION ? {} : { detail: err.message })
    });
};

// --- MIDDLEWARE CHÍNH ---
const validateAccessToken = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ error: 'Missing Authorization header' });
    }

    if (!authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Invalid Authorization format. Use: Bearer <token>' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token not provided' });

    jwt.verify(
        token,
        getKey,
        {
            algorithms: ['RS256'],
            // ⚙️ Cho phép nhiều issuer khác nhau
            issuer: VALID_ISSUERS,
            audience: VALID_AUDIENCES,
            clockTolerance: 60
        },
        (err, decoded) => {
            if (err) return handleJWTError(err, res);

            // ✅ Kiểm tra lại audience nếu cần
            const tokenAudience = decoded.aud;
            const isValidAudience = VALID_AUDIENCES.includes(tokenAudience) || tokenAudience?.includes(CLIENT_ID);

            if (!isValidAudience) {
                console.error("❌ Audience không hợp lệ:", {
                    received: tokenAudience,
                    expected: VALID_AUDIENCES
                });
                return res.status(403).json({
                    error: 'Invalid audience',
                    detail: `Token audience: ${tokenAudience}`
                });
            }

            // ✅ Kiểm tra Tenant ID nếu có
            if (decoded.tid && decoded.tid !== TENANT_ID) {
                console.warn("⚠️ Token từ tenant khác:", decoded.tid);
            }

            // ✅ Gán thông tin user
            req.auth = decoded;
            req.user = {
                id: decoded.oid || decoded.sub,
                email: decoded.preferred_username || decoded.email,
                name: decoded.name,
                roles: decoded.roles || [],
                tenantId: decoded.tid
            };

            if (!IS_PRODUCTION) {
                console.log("✅ Token hợp lệ:", {
                    user: req.user.email,
                    expires: new Date(decoded.exp * 1000).toISOString(),
                    issuer: decoded.iss
                });
            }

            next();
        }
    );
};

module.exports = validateAccessToken;
