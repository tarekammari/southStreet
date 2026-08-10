/* ==========================================================================
   SOUTH STREET (سوث ستريت) - Security & Code Authentication Protocol
   ========================================================================== */

class SecurityEngine {
  /**
   * Validate connection attempt using User ID / Name + Access Code
   */
  authenticate(nameOrId, accessCode) {
    if (!accessCode || accessCode.trim().length === 0) {
      return { success: false, message: 'يرجى إدخال رمز الأمان الخصوصي' };
    }

    const store = window.appStore;
    const cleanCode = accessCode.trim().toUpperCase();
    const user = store.findUserByCode(cleanCode);

    if (!user) {
      return { 
        success: false, 
        message: 'رمز الوصول غير صحيح أو منتهي الصلاحية. يرجى التواصل مع مسير الحملة أو المدير للحصول على كود جديد.' 
      };
    }

    // Check optional name matching if provided
    if (nameOrId && nameOrId.trim().length > 0) {
      const inputName = nameOrId.trim().toLowerCase();
      const storedName = user.name.toLowerCase();
      const storedId = user.id.toLowerCase();

      if (!storedName.includes(inputName) && !storedId.includes(inputName)) {
        return {
          success: false,
          message: 'اسم المستخدم أو المعرف غير متطابق مع كود الوصول المدخل.'
        };
      }
    }

    // Save session
    store.setSession(user);
    return { success: true, user };
  }

  /**
   * Generate a unique 8-character agency access code (e.g. SOUTH-7491)
   */
  generateAccessCode(rolePrefix = 'VIP') {
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    return `${rolePrefix.toUpperCase()}-${randomDigits}`;
  }

  /**
   * Check if active session user has permission for a specific action
   */
  hasRolePermission(user, allowedRoles) {
    if (!user) return false;
    if (user.role === 'admin') return true; // Admin has universal permission
    return allowedRoles.includes(user.role);
  }
}

window.securityEngine = new SecurityEngine();
