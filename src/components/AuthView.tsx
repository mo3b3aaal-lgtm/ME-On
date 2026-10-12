import React, { useState } from 'react';
import { UserAccount } from '../types';
import { db } from '../utils/storage';
import { useTranslation } from '../utils/i18n';
import { SegmentedControl } from './ui/SegmentedControl';
import { MintCard } from './ui/MintCard';
import { AppIcon } from './ui/AppIcon';
import { TeacherBoard } from './illustrations/TeacherBoard';

interface AuthViewProps {
  onLoginSuccess: (user: UserAccount) => void;
}

type AuthMode = 'login' | 'register' | 'forgot_password';

export const AuthView: React.FC<AuthViewProps> = ({ onLoginSuccess }) => {
  const { isRTL, language } = useTranslation();
  const isEn = language.startsWith('en');

  const [mode, setMode] = useState<AuthMode>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Login Form States
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  // Register Form States
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regSubject, setRegSubject] = useState(isEn ? 'Mathematics' : 'رياضيات');
  const [regCenter, setRegCenter] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regRecoveryPin, setRegRecoveryPin] = useState('');

  // Forgot Password States
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [resetRecoveryPin, setResetRecoveryPin] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');

  const clearMessages = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  // Handle Login Submit
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!loginIdentifier.trim()) {
      setErrorMessage(isEn ? 'Please enter your email, phone, or username.' : 'يرجى إدخال البريد الإلكتروني أو رقم الهاتف أو اسم المستخدم.');
      return;
    }
    if (!loginPassword) {
      setErrorMessage(isEn ? 'Please enter your password.' : 'يرجى إدخال كلمة المرور.');
      return;
    }

    setLoading(true);
    try {
      const res = await db.login(loginIdentifier, loginPassword);
      setLoading(false);
      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        setErrorMessage(res.error || (isEn ? 'Login failed. Please verify credentials.' : 'فشل تسجيل الدخول. تأكد من صحة البيانات.'));
      }
    } catch (err: any) {
      setLoading(false);
      setErrorMessage(err.message || (isEn ? 'Connection error while logging in.' : 'حدث خطأ أثناء الاتصال بالخادم.'));
    }
  };

  // Quick Demo Account Auto-Fill
  const handleQuickDemo = () => {
    const accounts = db.getAccounts();
    const firstAcc = accounts[0];
    if (firstAcc) {
      setLoginIdentifier(firstAcc.email);
      setLoginPassword('123456');
      setSuccessMessage(isEn ? 'Loaded demo teacher account credentials.' : 'تم ملء بيانات حساب المعلم التجريبي تلقائياً.');
    } else {
      setLoginIdentifier('teacher@classy.app');
      setLoginPassword('123456');
    }
  };

  // Handle Register Submit
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!regName.trim() || !regEmail.trim() || !regPassword) {
      setErrorMessage(isEn ? 'Please fill in all required fields.' : 'يرجى ملء جميع الحقول المطلوبة.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setErrorMessage(isEn ? 'Passwords do not match.' : 'كلمات المرور غير متطابقة.');
      return;
    }
    if (regPassword.length < 6) {
      setErrorMessage(isEn ? 'Password must be at least 6 characters.' : 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.');
      return;
    }

    setLoading(true);
    try {
      const res = await db.registerAccount({
        name: regName.trim(),
        email: regEmail.trim(),
        phone: regPhone.trim(),
        subject: regSubject.trim(),
        centerOrSchool: regCenter.trim(),
        password: regPassword,
        recoveryPin: regRecoveryPin.trim() || '123456',
      });
      setLoading(false);
      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        setErrorMessage(res.error || (isEn ? 'Failed to create account.' : 'فشل إنشاء الحساب.'));
      }
    } catch (err: any) {
      setLoading(false);
      setErrorMessage(err.message || (isEn ? 'Error creating account.' : 'حدث خطأ أثناء إنشاء الحساب.'));
    }
  };

  // Handle Forgot Password Submit
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!resetIdentifier.trim() || !resetRecoveryPin.trim()) {
      setErrorMessage(isEn ? 'Please enter identifier and recovery PIN.' : 'يرجى إدخال اسم المستخدم/البريد وكود الاسترداد.');
      return;
    }
    if (!resetNewPassword || resetNewPassword.length < 6) {
      setErrorMessage(isEn ? 'New password must be at least 6 characters.' : 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل.');
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      setErrorMessage(isEn ? 'Passwords do not match.' : 'كلمات المرور الجديدة غير متطابقة.');
      return;
    }

    setLoading(true);
    try {
      const res = await db.resetPassword(resetIdentifier.trim(), resetRecoveryPin.trim(), resetNewPassword);
      setLoading(false);
      if (res.success) {
        setSuccessMessage(isEn ? 'Password reset successfully! You can now log in.' : 'تمت إعادة تعيين كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول.');
        setLoginIdentifier(resetIdentifier);
        setLoginPassword(resetNewPassword);
        setTimeout(() => {
          setMode('login');
          setSuccessMessage(null);
        }, 1500);
      } else {
        setErrorMessage(res.error || (isEn ? 'Invalid recovery PIN.' : 'فشل التحقق من كود الاسترداد.'));
      }
    } catch (err: any) {
      setLoading(false);
      setErrorMessage(err.message || (isEn ? 'Error resetting password.' : 'حدث خطأ أثناء استعادة كلمة المرور.'));
    }
  };

  return (
    <div
      className="flex-1 overflow-y-auto android-scrollbar flex flex-col justify-between min-h-full bg-page text-navy select-none px-4 py-6 sm:px-6 max-w-lg mx-auto w-full"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="space-y-6">
        {/* Centered Logo & App Name */}
        <div className="text-center space-y-1 pt-2">
          <div className="inline-flex items-center justify-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-mint-soft text-navy flex items-center justify-center shadow-xs">
              <AppIcon name="teacher" size={24} weight="duotone" />
            </div>
            <span className="t-display text-navy tracking-tight font-black">Classy</span>
          </div>
          <p className="t-meta text-slate text-xs">
            {isEn
              ? 'Smart Tuition & Financial Management for Tutors'
              : 'منظومة المعلم الذكية لإدارة الطلاب والمجموعات والحصص'}
          </p>
        </div>

        {/* Large Illustration (TeacherBoard) in a MintCard Header Area */}
        <MintCard className="bg-mint-soft p-4 flex flex-col items-center justify-center overflow-hidden border border-line/60">
          <div className="w-48 sm:w-56 h-36 flex items-center justify-center">
            <TeacherBoard />
          </div>
        </MintCard>

        {/* Mode Selector Tab */}
        {mode !== 'forgot_password' ? (
          <SegmentedControl<'login' | 'register'>
            value={mode}
            onChange={(val) => {
              setMode(val);
              clearMessages();
            }}
            options={[
              { value: 'login', label: isEn ? 'Sign In' : 'تسجيل الدخول' },
              { value: 'register', label: isEn ? 'Create Account' : 'إنشاء حساب جديد' },
            ]}
          />
        ) : (
          <div className="flex items-center justify-between border-b border-line pb-2.5">
            <h2 className="t-card text-navy font-bold flex items-center gap-1.5">
              <AppIcon name="key" size={18} weight="duotone" />
              <span>{isEn ? 'Reset Password' : 'استعادة كلمة المرور'}</span>
            </h2>
            <button
              type="button"
              onClick={() => {
                setMode('login');
                clearMessages();
              }}
              className="btn-soft px-3 h-8 text-xs inline-flex items-center gap-1"
            >
              <span>{isEn ? 'Back to Sign In' : 'العودة للدخول'}</span>
              <AppIcon name="chevronEnd" size={14} />
            </button>
          </div>
        )}

        {/* Feedback Messages (errors coral) */}
        {errorMessage && (
          <div className="p-3 bg-coral/10 text-coral border border-coral/30 rounded-2xl text-xs font-bold flex items-start gap-2 animate-in fade-in">
            <AppIcon name="warning" size={16} weight="fill" className="shrink-0 mt-0.5 text-coral" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3 bg-teal/10 text-teal border border-teal/30 rounded-2xl text-xs font-bold flex items-start gap-2 animate-in fade-in">
            <AppIcon name="check" size={16} weight="bold" className="shrink-0 mt-0.5 text-teal" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* 1. LOGIN FORM */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="field-label">
                {isEn ? 'Email / Phone / Username' : 'البريد الإلكتروني / الهاتف / الاسم'}
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  placeholder={isEn ? 'teacher@example.com or phone' : 'مثال: teacher@example.com أو الهاتف'}
                  className={`classy-input ${isRTL ? 'pe-10' : 'ps-10'}`}
                />
                <span className={`absolute top-4 text-slate ${isRTL ? 'end-3.5' : 'start-3.5'}`}>
                  <AppIcon name="email" size={16} weight="duotone" />
                </span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="field-label mb-0">{isEn ? 'Password' : 'كلمة المرور'}</label>
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot_password');
                    clearMessages();
                  }}
                  className="text-xs text-navy hover:underline font-bold cursor-pointer"
                >
                  {isEn ? 'Forgot Password?' : 'نسيت كلمة المرور؟'}
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`classy-input ${isRTL ? 'pe-10 ps-10' : 'ps-10 pe-10'}`}
                />
                <span className={`absolute top-4 text-slate ${isRTL ? 'end-3.5' : 'start-3.5'}`}>
                  <AppIcon name="lock" size={16} weight="duotone" />
                </span>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute top-4 text-slate hover:text-navy cursor-pointer ${isRTL ? 'start-3.5' : 'end-3.5'}`}
                >
                  <AppIcon name={showPassword ? 'eyeOff' : 'eye'} size={16} />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer font-medium text-slate">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="classy-checkbox"
                />
                <span>{isEn ? 'Remember this session' : 'تذكر تسجيل الدخول دائماً'}</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-orange btn-lg w-full flex items-center justify-center gap-2"
            >
              {loading ? (
                <span>{isEn ? 'Signing In...' : 'جاري التحقق والدخول...'}</span>
              ) : (
                <>
                  <AppIcon name="check" size={18} weight="bold" />
                  <span>{isEn ? 'Sign In Now' : 'تسجيل الدخول الآن'}</span>
                </>
              )}
            </button>

            {/* Quick Demo Helper Button */}
            <div className="pt-2 border-t border-line">
              <button
                type="button"
                onClick={handleQuickDemo}
                className="btn-soft w-full text-xs flex items-center justify-center gap-2"
              >
                <AppIcon name="sparkles" size={16} />
                <span>{isEn ? 'Quick Demo Sign-In' : 'دخول سريع بحساب المعلم التجريبي (Demo)'}</span>
              </button>
            </div>
          </form>
        )}

        {/* 2. REGISTER FORM */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-3.5">
            <div>
              <label className="field-label">
                {isEn ? 'Teacher Full Name *' : 'اسم المعلم بالكامل *'}
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder={isEn ? 'e.g., Prof. Ahmed Ali' : 'مثال: أ/ محمد أحمد'}
                  className={`classy-input ${isRTL ? 'pe-10' : 'ps-10'}`}
                />
                <span className={`absolute top-4 text-slate ${isRTL ? 'end-3.5' : 'start-3.5'}`}>
                  <AppIcon name="teacher" size={16} weight="duotone" />
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="field-label">
                  {isEn ? 'Primary Subject *' : 'المادة الأساسية *'}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={regSubject}
                    onChange={(e) => setRegSubject(e.target.value)}
                    placeholder={isEn ? 'Mathematics' : 'رياضيات'}
                    className={`classy-input ${isRTL ? 'pe-10' : 'ps-10'}`}
                  />
                  <span className={`absolute top-4 text-slate ${isRTL ? 'end-3.5' : 'start-3.5'}`}>
                    <AppIcon name="bookOpen" size={16} weight="duotone" />
                  </span>
                </div>
              </div>

              <div>
                <label className="field-label">
                  {isEn ? 'Phone Number' : 'رقم الهاتف'}
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="01000000000"
                    className={`classy-input ${isRTL ? 'pe-10' : 'ps-10'}`}
                  />
                  <span className={`absolute top-4 text-slate ${isRTL ? 'end-3.5' : 'start-3.5'}`}>
                    <AppIcon name="phone" size={16} weight="duotone" />
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label className="field-label">
                {isEn ? 'Email Address / Username *' : 'البريد الإلكتروني / اسم المستخدم *'}
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="teacher@example.com"
                  className={`classy-input ${isRTL ? 'pe-10' : 'ps-10'}`}
                />
                <span className={`absolute top-4 text-slate ${isRTL ? 'end-3.5' : 'start-3.5'}`}>
                  <AppIcon name="email" size={16} weight="duotone" />
                </span>
              </div>
            </div>

            <div>
              <label className="field-label">
                {isEn ? 'Center / School Name' : 'اسم السنتر / المدرسة'}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={regCenter}
                  onChange={(e) => setRegCenter(e.target.value)}
                  placeholder={isEn ? 'e.g., Excellence Center' : 'مثال: سنتر الأوائل'}
                  className={`classy-input ${isRTL ? 'pe-10' : 'ps-10'}`}
                />
                <span className={`absolute top-4 text-slate ${isRTL ? 'end-3.5' : 'start-3.5'}`}>
                  <AppIcon name="school" size={16} weight="duotone" />
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="field-label">
                  {isEn ? 'Password *' : 'كلمة المرور *'}
                </label>
                <input
                  type="password"
                  required
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="••••••••"
                  className="classy-input"
                />
              </div>
              <div>
                <label className="field-label">
                  {isEn ? 'Confirm Password *' : 'تأكيد المرور *'}
                </label>
                <input
                  type="password"
                  required
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="classy-input"
                />
              </div>
            </div>

            <div>
              <label className="field-label">
                {isEn ? 'Recovery PIN (Optional)' : 'كود الاسترداد السري (اختياري)'}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={regRecoveryPin}
                  onChange={(e) => setRegRecoveryPin(e.target.value)}
                  placeholder={isEn ? 'Default: 123456' : 'الافتراضي: 123456'}
                  className={`classy-input ${isRTL ? 'pe-10' : 'ps-10'}`}
                />
                <span className={`absolute top-4 text-slate ${isRTL ? 'end-3.5' : 'start-3.5'}`}>
                  <AppIcon name="key" size={16} weight="duotone" />
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-orange btn-lg w-full flex items-center justify-center gap-2"
            >
              {loading ? (
                <span>{isEn ? 'Creating Account...' : 'جاري إنشاء الحساب...'}</span>
              ) : (
                <>
                  <AppIcon name="check" size={18} weight="bold" />
                  <span>{isEn ? 'Create Account Now' : 'إنشاء الحساب والبدء'}</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* 3. FORGOT PASSWORD FORM */}
        {mode === 'forgot_password' && (
          <form onSubmit={handleResetPassword} className="space-y-3.5">
            <div>
              <label className="field-label">
                {isEn ? 'Registered Email or Phone' : 'البريد الإلكتروني أو الهاتف'}
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={resetIdentifier}
                  onChange={(e) => setResetIdentifier(e.target.value)}
                  placeholder={isEn ? 'teacher@example.com' : 'مثال: teacher@example.com'}
                  className={`classy-input ${isRTL ? 'pe-10' : 'ps-10'}`}
                />
                <span className={`absolute top-4 text-slate ${isRTL ? 'end-3.5' : 'start-3.5'}`}>
                  <AppIcon name="email" size={16} weight="duotone" />
                </span>
              </div>
            </div>

            <div>
              <label className="field-label">
                {isEn ? 'Secret Recovery PIN' : 'كود الاستعادة السري (PIN)'}
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={resetRecoveryPin}
                  onChange={(e) => setResetRecoveryPin(e.target.value)}
                  placeholder={isEn ? 'Default: 123456' : 'الافتراضي: 123456'}
                  className={`classy-input ${isRTL ? 'pe-10' : 'ps-10'}`}
                />
                <span className={`absolute top-4 text-slate ${isRTL ? 'end-3.5' : 'start-3.5'}`}>
                  <AppIcon name="key" size={16} weight="duotone" />
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="field-label">
                  {isEn ? 'New Password' : 'كلمة المرور الجديدة'}
                </label>
                <input
                  type="password"
                  required
                  value={resetNewPassword}
                  onChange={(e) => setResetNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="classy-input"
                />
              </div>
              <div>
                <label className="field-label">
                  {isEn ? 'Confirm New Password' : 'تأكيد الجديدة'}
                </label>
                <input
                  type="password"
                  required
                  value={resetConfirmPassword}
                  onChange={(e) => setResetConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="classy-input"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-orange btn-lg w-full flex items-center justify-center gap-2"
            >
              {loading ? (
                <span>{isEn ? 'Updating Password...' : 'جاري تحديث كلمة المرور...'}</span>
              ) : (
                <>
                  <AppIcon name="check" size={18} weight="bold" />
                  <span>{isEn ? 'Update Password & Sign In' : 'تحديث كلمة المرور والدخول'}</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>

      {/* Footer Info */}
      <footer className="text-center text-[11px] text-slate mt-8 pt-4 border-t border-line">
        <p className="font-medium">
          {isEn ? 'Classy • Smart Teacher Management System' : 'تطبيق Classy • نظام إدارة المعلم والمجموعات الذكي'}
        </p>
      </footer>
    </div>
  );
};

export default AuthView;
