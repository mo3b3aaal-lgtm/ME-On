import React, { useState } from 'react';
import {
  Lock,
  Mail,
  User,
  Phone,
  BookOpen,
  Building,
  KeyRound,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { UserAccount } from '../types';
import { db } from '../utils/storage';
import { ClassyOwlMascot } from './ClassyOwlMascot';
import { useTranslation } from '../utils/i18n';

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
      setLoginPassword(firstAcc.password || 'password123');
    } else {
      setLoginIdentifier('teacher@example.com');
      setLoginPassword('password123');
    }
    setSuccessMessage(isEn ? 'Demo teacher credentials filled in automatically.' : 'تم تعبئة بيانات الحساب التجريبي المخصص للمعلم.');
    setTimeout(() => setSuccessMessage(null), 3500);
  };

  // Handle Register Submit
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!regName.trim()) {
      setErrorMessage(isEn ? 'Please enter teacher full name.' : 'يرجى إدخال اسم المعلم بالكامل.');
      return;
    }
    if (!regEmail.trim()) {
      setErrorMessage(isEn ? 'Please enter a valid email address.' : 'يرجى إدخال البريد الإلكتروني.');
      return;
    }
    if (!regPassword || regPassword.length < 4) {
      setErrorMessage(isEn ? 'Password must be at least 4 characters.' : 'يجب ألا تقل كلمة المرور عن 4 أحرف أو أرقام.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setErrorMessage(isEn ? 'Passwords do not match.' : 'كلمتا المرور غير متطابقتين.');
      return;
    }

    setLoading(true);
    try {
      const res = await db.registerAccount({
        name: regName,
        email: regEmail,
        phone: regPhone,
        subject: regSubject,
        centerOrSchool: regCenter,
        password: regPassword,
        recoveryPin: regRecoveryPin || '123456',
        securityQuestion: isEn ? 'What is your core academic subject?' : 'ما هي مادتك الأساسية؟',
        securityAnswer: regSubject,
      });

      setLoading(false);
      if (res.success && res.user) {
        setSuccessMessage(isEn ? 'Account created successfully! Signing in...' : 'تم إنشاء الحساب بنجاح في السيرفر السحابي! جاري الدخول...');
        setTimeout(() => {
          onLoginSuccess(res.user!);
        }, 500);
      } else {
        setErrorMessage(res.error || (isEn ? 'Error while creating account.' : 'حدث خطأ أثناء إنشاء الحساب.'));
      }
    } catch (err: any) {
      setLoading(false);
      setErrorMessage(err.message || (isEn ? 'Connection error while creating account.' : 'حدث خطأ في الاتصال أثناء إنشاء الحساب.'));
    }
  };

  // Handle Forgot Password Submit
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!resetIdentifier.trim()) {
      setErrorMessage(isEn ? 'Please enter registered email or phone.' : 'يرجى إدخال البريد الإلكتروني أو الهاتف المرتبط بالحساب.');
      return;
    }
    if (!resetRecoveryPin.trim()) {
      setErrorMessage(isEn ? 'Please enter your recovery PIN.' : 'يرجى إدخال كود الاسترداد السري (PIN).');
      return;
    }
    if (!resetNewPassword || resetNewPassword.length < 4) {
      setErrorMessage(isEn ? 'New password must be at least 4 characters.' : 'يجب ألا تقل كلمة المرور الجديدة عن 4 أحرف أو أرقام.');
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      setErrorMessage(isEn ? 'New passwords do not match.' : 'كلمتا المرور الجديدتان غير متطابقتين.');
      return;
    }

    setLoading(true);
    try {
      const res = await db.resetPassword(resetIdentifier, resetNewPassword, resetRecoveryPin);
      setLoading(false);
      if (res.success) {
        setSuccessMessage(isEn ? 'Password reset successfully! You can now log in with your new password.' : 'تمت إعادة تعيين كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.');
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
    <div className="flex-1 overflow-y-auto android-scrollbar flex flex-col justify-between min-h-full bg-gradient-to-b from-[#17375E] via-[#0F2A4A] to-[#0F2A4A] text-[#FFFFFF] select-none relative" dir={isRTL ? 'rtl' : 'ltr'}>
      
      {/* Background ambient lighting */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-[#17375E]/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-40 left-0 w-72 h-72 bg-[#0F2A4A]/18 rounded-full blur-3xl pointer-events-none" />

      {/* Hero Section with Classy Mascot */}
      <div className="relative z-10 pt-6 pb-2 px-5 text-center flex flex-col items-center">
        
        {/* Mascot in Glowing Oval Canvas */}
        <div className="relative w-28 h-28 sm:w-32 sm:h-32 mb-3 flex items-center justify-center">
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-[#17375E]/35 to-[#0F2A4A]/35 blur-md transform -rotate-3" />
          <div className="relative w-full h-full rounded-3xl bg-[#0F2A4A] border border-[#17375E]/35 flex items-center justify-center shadow-xl overflow-hidden">
            <ClassyOwlMascot size="lg" glow={false} pose="smart" />
          </div>
          
          <div className="absolute -bottom-2 -left-1 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-[#0F2A4A] to-[#17375E] text-[#FFFFFF] text-[10px] font-extrabold shadow-md flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5" />
            <span>Classy</span>
          </div>
        </div>

        <h1 className="text-2xl font-black tracking-tight text-[#FFFFFF] flex items-center gap-1.5 justify-center">
          <span>{isEn ? 'Welcome to' : 'مرحباً بك في'}</span>
          <span className="text-[#17375E]">Classy</span>
        </h1>
        <p className="text-xs text-[#E1EBEC] font-medium max-w-xs mt-1">
          {isEn
            ? 'Smart Tuition & Financial Management for Tutors and Academies'
            : 'منظومة المعلم الذكية لإدارة الطلاب والمجموعات والحصص والحسابات'}
        </p>
      </div>

      {/* Main Form Surface Container */}
      <div className="relative z-10 bg-[#FFFFFF] rounded-t-[36px] shadow-2xl p-5 sm:p-6 text-[#0F2A4A] flex-1 flex flex-col justify-between mt-2 border-t border-[#17375E]/40">
        
        <div className="space-y-4">
          {/* Mode Selector Tab */}
          {mode !== 'forgot_password' ? (
            <div className="flex items-center p-1.5 bg-[#E1EBEC]/15 rounded-2xl border border-[#E1EBEC]">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  clearMessages();
                }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  mode === 'login'
                    ? 'bg-[#17375E] text-[#FFFFFF] shadow-md'
                    : 'text-[#5F7083] hover:text-[#0F2A4A]'
                }`}
              >
                {isEn ? 'Sign In' : 'تسجيل الدخول'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  clearMessages();
                }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  mode === 'register'
                    ? 'bg-[#17375E] text-[#FFFFFF] shadow-md'
                    : 'text-[#5F7083] hover:text-[#0F2A4A]'
                }`}
              >
                {isEn ? 'Create Account' : 'إنشاء حساب جديد'}
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between border-b border-[#E1EBEC] pb-2.5">
              <h2 className="text-sm font-bold text-[#0F2A4A] flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-[#0F2A4A]" />
                <span>{isEn ? 'Reset Password' : 'استعادة كلمة المرور'}</span>
              </h2>
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  clearMessages();
                }}
                className="text-xs text-[#17375E] hover:text-[#0F2A4A] font-bold flex items-center gap-1 cursor-pointer"
              >
                <span>{isEn ? 'Back to Sign In' : 'العودة للدخول'}</span>
                {isRTL ? <ArrowRight className="w-3.5 h-3.5" /> : <ArrowLeft className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}

          {/* Feedback Messages */}
          {errorMessage && (
            <div className="p-3 bg-[#17375E]/10 text-[#17375E] border border-[#17375E]/30 rounded-2xl text-xs font-bold flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#17375E]" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-[#17375E]/15 text-[#0F2A4A] border border-[#17375E]/40 rounded-2xl text-xs font-bold flex items-start gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#17375E]" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* 1. LOGIN FORM */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-[#0F2A4A] mb-1.5">
                  {isEn ? 'Email / Phone / Username' : 'البريد الإلكتروني / الهاتف / الاسم'}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder={isEn ? 'e.g., teacher@example.com or 01000000000' : 'مثال: teacher@example.com أو 01000000000'}
                    className={`w-full bg-[#E1EBEC]/15 border border-[#E1EBEC] rounded-2xl p-3 text-xs text-[#0F2A4A] font-semibold focus:outline-none focus:border-[#17375E] focus:ring-2 focus:ring-[#17375E]/20 transition-all placeholder:text-[#5F7083]/65 ${
                      isRTL ? 'pr-10' : 'pl-10'
                    }`}
                  />
                  <Mail className={`w-4 h-4 text-[#17375E] absolute top-3.5 ${isRTL ? 'right-3.5' : 'left-3.5'}`} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold text-[#0F2A4A]">{isEn ? 'Password' : 'كلمة المرور'}</label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot_password');
                      clearMessages();
                    }}
                    className="text-[11px] text-[#0F2A4A] hover:text-[#17375E] font-bold cursor-pointer transition-colors"
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
                    className={`w-full bg-[#E1EBEC]/15 border border-[#E1EBEC] rounded-2xl p-3 text-xs text-[#0F2A4A] font-semibold focus:outline-none focus:border-[#17375E] focus:ring-2 focus:ring-[#17375E]/20 transition-all placeholder:text-[#5F7083]/65 ${
                      isRTL ? 'pr-10 pl-10' : 'pl-10 pr-10'
                    }`}
                  />
                  <Lock className={`w-4 h-4 text-[#17375E] absolute top-3.5 ${isRTL ? 'right-3.5' : 'left-3.5'}`} />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={`absolute top-3.5 text-[#5F7083] hover:text-[#0F2A4A] cursor-pointer ${isRTL ? 'left-3.5' : 'right-3.5'}`}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-[#5F7083]">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded-md border-[#E1EBEC] text-[#17375E] focus:ring-0 accent-[#17375E]"
                  />
                  <span>{isEn ? 'Remember this session' : 'تذكر تسجيل الدخول دائماً'}</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#17375E] to-[#0F2A4A] text-[#FFFFFF] font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#17375E]/30 transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer"
              >
                {loading ? (
                  <span>{isEn ? 'Signing In...' : 'جاري التحقق والدخول...'}</span>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>{isEn ? 'Sign In Now' : 'تسجيل الدخول الآن'}</span>
                  </>
                )}
              </button>

              {/* Quick Demo Helper Button */}
              <div className="pt-2 border-t border-[#E1EBEC]">
                <button
                  type="button"
                  onClick={handleQuickDemo}
                  className="w-full py-2.5 px-3 rounded-2xl bg-[#E1EBEC]/15 hover:bg-[#E1EBEC]/35 text-[#0F2A4A] border border-[#E1EBEC] font-bold text-[11px] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#E1EBEC]" />
                  <span>{isEn ? 'Quick Sign-In with Demo Account' : 'دخول سريع بحساب المعلم التجريبي (Demo Account)'}</span>
                </button>
              </div>
            </form>
          )}

          {/* 2. REGISTER FORM */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-[#0F2A4A] mb-1">
                  {isEn ? 'Teacher Full Name *' : 'اسم المعلم بالكامل *'}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder={isEn ? 'e.g., Prof. Ahmed Ali' : 'مثال: أ/ محمد أحمد'}
                    className={`w-full bg-[#E1EBEC]/15 border border-[#E1EBEC] rounded-2xl p-2.5 text-xs text-[#0F2A4A] font-semibold focus:outline-none focus:border-[#17375E] ${
                      isRTL ? 'pr-9' : 'pl-9'
                    }`}
                  />
                  <User className={`w-4 h-4 text-[#17375E] absolute top-3 ${isRTL ? 'right-3' : 'left-3'}`} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-[#0F2A4A] mb-1">
                    {isEn ? 'Primary Subject *' : 'المادة الأساسية *'}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={regSubject}
                      onChange={(e) => setRegSubject(e.target.value)}
                      placeholder={isEn ? 'Mathematics, Physics...' : 'رياضيات، لغة عربية...'}
                      className={`w-full bg-[#E1EBEC]/15 border border-[#E1EBEC] rounded-2xl p-2.5 text-xs text-[#0F2A4A] font-semibold focus:outline-none focus:border-[#17375E] ${
                        isRTL ? 'pr-8' : 'pl-8'
                      }`}
                    />
                    <BookOpen className={`w-3.5 h-3.5 text-[#17375E] absolute top-3 ${isRTL ? 'right-2.5' : 'left-2.5'}`} />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-[#0F2A4A] mb-1">
                    {isEn ? 'Phone Number' : 'رقم الهاتف'}
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="01000000000"
                      className={`w-full bg-[#E1EBEC]/15 border border-[#E1EBEC] rounded-2xl p-2.5 text-xs text-[#0F2A4A] font-semibold focus:outline-none focus:border-[#17375E] ${
                        isRTL ? 'pr-8' : 'pl-8'
                      }`}
                    />
                    <Phone className={`w-3.5 h-3.5 text-[#17375E] absolute top-3 ${isRTL ? 'right-2.5' : 'left-2.5'}`} />
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#0F2A4A] mb-1">
                  {isEn ? 'Email Address / Username *' : 'البريد الإلكتروني / اسم المستخدم *'}
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="teacher@example.com"
                    className={`w-full bg-[#E1EBEC]/15 border border-[#E1EBEC] rounded-2xl p-2.5 text-xs text-[#0F2A4A] font-semibold focus:outline-none focus:border-[#17375E] ${
                      isRTL ? 'pr-9' : 'pl-9'
                    }`}
                  />
                  <Mail className={`w-4 h-4 text-[#17375E] absolute top-3 ${isRTL ? 'right-3' : 'left-3'}`} />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#0F2A4A] mb-1">
                  {isEn ? 'Center / School Name' : 'اسم السنتر / المدرسة'}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={regCenter}
                    onChange={(e) => setRegCenter(e.target.value)}
                    placeholder={isEn ? 'e.g., Excellence Center' : 'مثال: سنتر الأوائل'}
                    className={`w-full bg-[#E1EBEC]/15 border border-[#E1EBEC] rounded-2xl p-2.5 text-xs text-[#0F2A4A] font-semibold focus:outline-none focus:border-[#17375E] ${
                      isRTL ? 'pr-9' : 'pl-9'
                    }`}
                  />
                  <Building className={`w-4 h-4 text-[#17375E] absolute top-3 ${isRTL ? 'right-3' : 'left-3'}`} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-[#0F2A4A] mb-1">
                    {isEn ? 'Password *' : 'كلمة المرور *'}
                  </label>
                  <input
                    type="password"
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#E1EBEC]/15 border border-[#E1EBEC] rounded-2xl p-2.5 text-xs text-[#0F2A4A] font-semibold focus:outline-none focus:border-[#17375E]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#0F2A4A] mb-1">
                    {isEn ? 'Confirm Password *' : 'تأكيد المرور *'}
                  </label>
                  <input
                    type="password"
                    required
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#E1EBEC]/15 border border-[#E1EBEC] rounded-2xl p-2.5 text-xs text-[#0F2A4A] font-semibold focus:outline-none focus:border-[#17375E]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#0F2A4A] mb-1 flex items-center justify-between">
                  <span>{isEn ? 'Secret Recovery PIN *' : 'كود استعادة سري (PIN) *'}</span>
                  <span className="text-[10px] text-[#5F7083]">{isEn ? 'Used for account recovery' : 'لاسترجاع الحساب عند النسيان'}</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    maxLength={6}
                    value={regRecoveryPin}
                    onChange={(e) => setRegRecoveryPin(e.target.value)}
                    placeholder={isEn ? 'e.g., 123456' : 'مثال: 123456'}
                    className={`w-full bg-[#E1EBEC]/15 border border-[#E1EBEC] rounded-2xl p-2.5 text-xs text-[#0F2A4A] font-semibold focus:outline-none focus:border-[#17375E] ${
                      isRTL ? 'pr-9' : 'pl-9'
                    }`}
                  />
                  <KeyRound className={`w-4 h-4 text-[#0F2A4A] absolute top-3 ${isRTL ? 'right-3' : 'left-3'}`} />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#17375E] to-[#0F2A4A] text-[#FFFFFF] font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-[#17375E]/30 transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer"
              >
                {loading ? (
                  <span>{isEn ? 'Creating Account...' : 'جاري إنشاء الحساب...'}</span>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>{isEn ? 'Create Account & Get Started' : 'إنشاء الحساب وبدء الاستخدام'}</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* 3. FORGOT PASSWORD FORM */}
          {mode === 'forgot_password' && (
            <form onSubmit={handleResetPassword} className="space-y-3 text-xs">
              <p className="text-[11px] text-[#5F7083] leading-relaxed">
                {isEn
                  ? 'Enter your registered email or phone with your secret recovery PIN to set a new password.'
                  : 'أدخل بريدك الإلكتروني أو رقم هاتفك المسجل مسبقاً، مع كود الاستعادة السري (PIN) لتعيين كلمة مرور جديدة.'}
              </p>

              <div>
                <label className="block font-bold text-[#0F2A4A] mb-1">
                  {isEn ? 'Registered Email or Phone' : 'البريد الإلكتروني أو الهاتف'}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={resetIdentifier}
                    onChange={(e) => setResetIdentifier(e.target.value)}
                    placeholder={isEn ? 'e.g., teacher@example.com' : 'مثال: teacher@example.com'}
                    className={`w-full bg-[#E1EBEC]/15 border border-[#E1EBEC] rounded-2xl p-2.5 text-xs text-[#0F2A4A] font-semibold focus:outline-none focus:border-[#17375E] ${
                      isRTL ? 'pr-9' : 'pl-9'
                    }`}
                  />
                  <Mail className={`w-4 h-4 text-[#17375E] absolute top-3 ${isRTL ? 'right-3' : 'left-3'}`} />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#0F2A4A] mb-1">
                  {isEn ? 'Secret Recovery PIN' : 'كود الاستعادة السري (PIN)'}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={resetRecoveryPin}
                    onChange={(e) => setResetRecoveryPin(e.target.value)}
                    placeholder={isEn ? 'Default: 123456' : 'الكود المحدد عند التسجيل (الافتراضي: 123456)'}
                    className={`w-full bg-[#E1EBEC]/15 border border-[#E1EBEC] rounded-2xl p-2.5 text-xs text-[#0F2A4A] font-semibold focus:outline-none focus:border-[#17375E] ${
                      isRTL ? 'pr-9' : 'pl-9'
                    }`}
                  />
                  <KeyRound className={`w-4 h-4 text-[#0F2A4A] absolute top-3 ${isRTL ? 'right-3' : 'left-3'}`} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-[#0F2A4A] mb-1">
                    {isEn ? 'New Password' : 'كلمة المرور الجديدة'}
                  </label>
                  <input
                    type="password"
                    required
                    value={resetNewPassword}
                    onChange={(e) => setResetNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#E1EBEC]/15 border border-[#E1EBEC] rounded-2xl p-2.5 text-xs text-[#0F2A4A] font-semibold focus:outline-none focus:border-[#17375E]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#0F2A4A] mb-1">
                    {isEn ? 'Confirm New Password' : 'تأكيد الجديدة'}
                  </label>
                  <input
                    type="password"
                    required
                    value={resetConfirmPassword}
                    onChange={(e) => setResetConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#E1EBEC]/15 border border-[#E1EBEC] rounded-2xl p-2.5 text-xs text-[#0F2A4A] font-semibold focus:outline-none focus:border-[#17375E]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#17375E] to-[#0F2A4A] text-[#FFFFFF] font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-[#17375E]/30 transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer"
              >
                {loading ? (
                  <span>{isEn ? 'Updating Password...' : 'جاري تحديث كلمة المرور...'}</span>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>{isEn ? 'Update Password & Sign In' : 'تحديث كلمة المرور والدخول'}</span>
                  </>
                )}
              </button>
            </form>
          )}

        </div>

        {/* Footer Info */}
        <div className="text-center text-[11px] text-[#5F7083] mt-4 pt-2 border-t border-[#E1EBEC]">
          <p className="font-medium">{isEn ? 'Classy • Smart Teacher Management System' : 'تطبيق Classy • نظام إدارة المعلم والمجموعات الذكي'}</p>
        </div>

      </div>

    </div>
  );
};
