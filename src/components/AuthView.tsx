import React, { useState } from 'react';
import {
  GraduationCap,
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
  CheckCircle2,
  AlertCircle,
  Sparkles,
  HelpCircle,
  ShieldCheck,
  Terminal,
  Activity,
  Server,
  XCircle,
} from 'lucide-react';
import { UserAccount, AuthDiagnostics } from '../types';
import { db } from '../utils/storage';

interface AuthViewProps {
  onLoginSuccess: (user: UserAccount) => void;
}

type AuthMode = 'login' | 'register' | 'forgot_password';

export const AuthView: React.FC<AuthViewProps> = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [diagData, setDiagData] = useState<AuthDiagnostics | null>(db.getLastAuthDiagnostics());
  const [showDiagPanel, setShowDiagPanel] = useState(true);

  // Login Form States
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  // Register Form States
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regSubject, setRegSubject] = useState('رياضيات');
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
      setErrorMessage('يرجى إدخال البريد الإلكتروني أو رقم الهاتف أو اسم المستخدم.');
      return;
    }
    if (!loginPassword) {
      setErrorMessage('يرجى إدخال كلمة المرور.');
      return;
    }

    setLoading(true);
    try {
      const res = await db.login(loginIdentifier, loginPassword);
      setLoading(false);
      setDiagData(res.diagnostics || db.getLastAuthDiagnostics());
      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        setErrorMessage(res.error || 'فشل تسجيل الدخول. تأكد من صحة البيانات.');
      }
    } catch (err: any) {
      setLoading(false);
      setDiagData(db.getLastAuthDiagnostics());
      setErrorMessage(err.message || 'حدث خطأ أثناء الاتصال بالخادم.');
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
    setSuccessMessage('تم تعبئة بيانات الحساب التجريبي المخصص للمعلم.');
    setTimeout(() => setSuccessMessage(null), 3500);
  };

  // Handle Register Submit
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!regName.trim()) {
      setErrorMessage('يرجى إدخال اسم المعلم بالكامل.');
      return;
    }
    if (!regEmail.trim()) {
      setErrorMessage('يرجى إدخال البريد الإلكتروني.');
      return;
    }
    if (!regPassword || regPassword.length < 4) {
      setErrorMessage('يجب ألا تقل كلمة المرور عن 4 أحرف أو أرقام.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setErrorMessage('كلمتا المرور غير متطابقتين.');
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
        securityQuestion: 'ما هي مادتك الأساسية؟',
        securityAnswer: regSubject,
      });

      setLoading(false);
      if (res.success && res.user) {
        setSuccessMessage('تم إنشاء الحساب بنجاح في السيرفر السحابي! جاري الدخول...');
        setTimeout(() => {
          onLoginSuccess(res.user!);
        }, 500);
      } else {
        setErrorMessage(res.error || 'حدث خطأ أثناء إنشاء الحساب.');
      }
    } catch (err: any) {
      setLoading(false);
      setErrorMessage(err.message || 'حدث خطأ في الاتصال أثناء إنشاء الحساب.');
    }
  };

  // Handle Forgot Password Submit
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!resetIdentifier.trim()) {
      setErrorMessage('يرجى إدخال البريد الإلكتروني أو الهاتف المرتبط بالحساب.');
      return;
    }
    if (!resetRecoveryPin.trim()) {
      setErrorMessage('يرجى إدخال كود الاسترداد السري (PIN).');
      return;
    }
    if (!resetNewPassword || resetNewPassword.length < 4) {
      setErrorMessage('يجب ألا تقل كلمة المرور الجديدة عن 4 أحرف أو أرقام.');
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      setErrorMessage('كلمتا المرور الجديدتان غير متطابقتين.');
      return;
    }

    setLoading(true);
    try {
      const res = await db.resetPassword(resetIdentifier, resetNewPassword, resetRecoveryPin);
      setLoading(false);
      if (res.success) {
        setSuccessMessage('تمت إعادة تعيين كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.');
        setLoginIdentifier(resetIdentifier);
        setLoginPassword(resetNewPassword);
        setTimeout(() => {
          setMode('login');
          setSuccessMessage(null);
        }, 1500);
      } else {
        setErrorMessage(res.error || 'فشل التحقق من كود الاسترداد.');
      }
    } catch (err: any) {
      setLoading(false);
      setErrorMessage(err.message || 'حدث خطأ أثناء استعادة كلمة المرور.');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto android-scrollbar p-4 flex flex-col justify-center max-w-md mx-auto w-full text-[#2D332A] select-none" dir="rtl">
      
      {/* Brand Header */}
      <div className="text-center space-y-2 mb-4 pt-2">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-linear-to-br from-[#748C70] to-[#556952] text-white shadow-md">
          <GraduationCap className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-black font-serif text-[#2D332A] tracking-tight">
          Teacher Manager
        </h1>
        <p className="text-xs text-[#8A9187] font-semibold">
          نظام إدارة المعلم والطلاب والمجموعات والحصص والمحاسبة
        </p>
      </div>

      {/* Auth Card Container */}
      <div className="bg-white border border-[#E8E2D6] rounded-3xl shadow-sm p-5 space-y-4">
        
        {/* Mode Selector (Login vs Register vs Forgot) */}
        {mode !== 'forgot_password' ? (
          <div className="flex items-center p-1 bg-[#F0EBE1] rounded-2xl">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                clearMessages();
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                mode === 'login'
                  ? 'bg-white text-[#2D332A] shadow-xs'
                  : 'text-[#8A9187] hover:text-[#2D332A]'
              }`}
            >
              تسجيل الدخول
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                clearMessages();
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                mode === 'register'
                  ? 'bg-white text-[#2D332A] shadow-xs'
                  : 'text-[#8A9187] hover:text-[#2D332A]'
              }`}
            >
              إنشاء حساب جديد
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between border-b border-[#E8E2D6] pb-2">
            <h2 className="text-sm font-bold text-[#2D332A] flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-[#D49B4B]" />
              <span>استعادة كلمة المرور</span>
            </h2>
            <button
              type="button"
              onClick={() => {
                setMode('login');
                clearMessages();
              }}
              className="text-xs text-[#748C70] hover:text-[#5E755A] font-bold flex items-center gap-1"
            >
              <span>العودة للدخول</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Feedback Messages */}
        {errorMessage && (
          <div className="p-3 bg-[#FCF6F4] text-[#C97C5D] border border-[#C97C5D]/30 rounded-xl text-xs font-bold flex items-start gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3 bg-[#748C70]/15 text-[#748C70] border border-[#748C70]/30 rounded-xl text-xs font-bold flex items-start gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* 1. LOGIN FORM */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-3.5 text-xs">
            <div>
              <label className="block font-bold text-[#6B7567] mb-1">البريد الإلكتروني / الهاتف / الاسم</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  placeholder="مثال: teacher@example.com أو 01000000000"
                  className="w-full bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl p-2.5 pr-9 text-xs text-[#2D332A] focus:outline-none focus:border-[#748C70] focus:ring-1 focus:ring-[#748C70]"
                />
                <Mail className="w-4 h-4 text-[#8A9187] absolute right-3 top-3" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-[#6B7567]">كلمة المرور</label>
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot_password');
                    clearMessages();
                  }}
                  className="text-[11px] text-[#D49B4B] hover:text-[#B88237] font-bold"
                >
                  نسيت كلمة المرور؟
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl p-2.5 pr-9 pl-9 text-xs text-[#2D332A] focus:outline-none focus:border-[#748C70] focus:ring-1 focus:ring-[#748C70]"
                />
                <Lock className="w-4 h-4 text-[#8A9187] absolute right-3 top-3" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-3 text-[#8A9187] hover:text-[#2D332A]"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-[#6B7567]">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-[#E8E2D6] text-[#748C70] focus:ring-0"
                />
                <span>تذكر تسجيل الدخول دائماً</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-[#748C70] hover:bg-[#5E755A] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-[0.99] disabled:opacity-60"
            >
              {loading ? (
                <span>جاري التحقق والدخول...</span>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>تسجيل الدخول</span>
                </>
              )}
            </button>

            {/* Quick Demo Helper Button */}
            <div className="pt-2 border-t border-[#E8E2D6]/50">
              <button
                type="button"
                onClick={handleQuickDemo}
                className="w-full py-2 px-3 rounded-xl bg-[#F0EBE1]/60 hover:bg-[#F0EBE1] text-[#6B7567] hover:text-[#2D332A] font-bold text-[11px] flex items-center justify-center gap-1.5 transition-all"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#D49B4B]" />
                <span>دخول سريع بحساب المعلم التجريبي (Default Account)</span>
              </button>
            </div>
          </form>
        )}

        {/* 2. REGISTER FORM */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-[#6B7567] mb-1">اسم المعلم بالكامل *</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="مثال: أ/ محمد أحمد"
                  className="w-full bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl p-2.5 pr-9 text-xs text-[#2D332A] focus:outline-none focus:border-[#748C70]"
                />
                <User className="w-4 h-4 text-[#8A9187] absolute right-3 top-3" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-bold text-[#6B7567] mb-1">المادة الأساسية *</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={regSubject}
                    onChange={(e) => setRegSubject(e.target.value)}
                    placeholder="رياضيات، لغة عربية..."
                    className="w-full bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl p-2.5 pr-8 text-xs text-[#2D332A] focus:outline-none focus:border-[#748C70]"
                  />
                  <BookOpen className="w-3.5 h-3.5 text-[#8A9187] absolute right-2.5 top-3" />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#6B7567] mb-1">رقم الهاتف</label>
                <div className="relative">
                  <input
                    type="tel"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="01000000000"
                    className="w-full bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl p-2.5 pr-8 text-xs text-[#2D332A] focus:outline-none focus:border-[#748C70]"
                  />
                  <Phone className="w-3.5 h-3.5 text-[#8A9187] absolute right-2.5 top-3" />
                </div>
              </div>
            </div>

            <div>
              <label className="block font-bold text-[#6B7567] mb-1">البريد الإلكتروني / اسم المستخدم *</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="teacher@example.com"
                  className="w-full bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl p-2.5 pr-9 text-xs text-[#2D332A] focus:outline-none focus:border-[#748C70]"
                />
                <Mail className="w-4 h-4 text-[#8A9187] absolute right-3 top-3" />
              </div>
            </div>

            <div>
              <label className="block font-bold text-[#6B7567] mb-1">اسم السنتر / المدرسة</label>
              <div className="relative">
                <input
                  type="text"
                  value={regCenter}
                  onChange={(e) => setRegCenter(e.target.value)}
                  placeholder="مثال: سنتر الأوائل"
                  className="w-full bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl p-2.5 pr-9 text-xs text-[#2D332A] focus:outline-none focus:border-[#748C70]"
                />
                <Building className="w-4 h-4 text-[#8A9187] absolute right-3 top-3" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-bold text-[#6B7567] mb-1">كلمة المرور *</label>
                <input
                  type="password"
                  required
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl p-2.5 text-xs text-[#2D332A] focus:outline-none focus:border-[#748C70]"
                />
              </div>
              <div>
                <label className="block font-bold text-[#6B7567] mb-1">تأكيد المرور *</label>
                <input
                  type="password"
                  required
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl p-2.5 text-xs text-[#2D332A] focus:outline-none focus:border-[#748C70]"
                />
              </div>
            </div>

            {/* Recovery PIN code for secure password reset */}
            <div>
              <label className="block font-bold text-[#6B7567] mb-1 flex items-center justify-between">
                <span>كود استعادة سري (PIN) *</span>
                <span className="text-[10px] text-[#8A9187]">لاسترجاع كلمة المرور عند نسيانها</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  maxLength={6}
                  value={regRecoveryPin}
                  onChange={(e) => setRegRecoveryPin(e.target.value)}
                  placeholder="مثال: 123456"
                  className="w-full bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl p-2.5 pr-9 text-xs text-[#2D332A] focus:outline-none focus:border-[#748C70]"
                />
                <KeyRound className="w-4 h-4 text-[#8A9187] absolute right-3 top-3" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-[#748C70] hover:bg-[#5E755A] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-[0.99] disabled:opacity-60"
            >
              {loading ? (
                <span>جاري إنشاء الحساب...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>إنشاء الحساب وبدء الاستخدام</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* 3. FORGOT PASSWORD FORM */}
        {mode === 'forgot_password' && (
          <form onSubmit={handleResetPassword} className="space-y-3 text-xs">
            <p className="text-[11px] text-[#8A9187] leading-relaxed">
              أدخل بريدك الإلكتروني أو رقم هاتفك المسجل مسبقاً، مع كود الاستعادة السري (PIN) لتعيين كلمة مرور جديدة.
            </p>

            <div>
              <label className="block font-bold text-[#6B7567] mb-1">البريد الإلكتروني أو الهاتف</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={resetIdentifier}
                  onChange={(e) => setResetIdentifier(e.target.value)}
                  placeholder="مثال: teacher@example.com"
                  className="w-full bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl p-2.5 pr-9 text-xs text-[#2D332A] focus:outline-none focus:border-[#748C70]"
                />
                <Mail className="w-4 h-4 text-[#8A9187] absolute right-3 top-3" />
              </div>
            </div>

            <div>
              <label className="block font-bold text-[#6B7567] mb-1">كود الاستعادة السري (PIN)</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={resetRecoveryPin}
                  onChange={(e) => setResetRecoveryPin(e.target.value)}
                  placeholder="الكود المحدد عند التسجيل (الافتراضي: 123456)"
                  className="w-full bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl p-2.5 pr-9 text-xs text-[#2D332A] focus:outline-none focus:border-[#748C70]"
                />
                <KeyRound className="w-4 h-4 text-[#8A9187] absolute right-3 top-3" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-bold text-[#6B7567] mb-1">كلمة المرور الجديدة</label>
                <input
                  type="password"
                  required
                  value={resetNewPassword}
                  onChange={(e) => setResetNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl p-2.5 text-xs text-[#2D332A] focus:outline-none focus:border-[#748C70]"
                />
              </div>
              <div>
                <label className="block font-bold text-[#6B7567] mb-1">تأكيد الجديدة</label>
                <input
                  type="password"
                  required
                  value={resetConfirmPassword}
                  onChange={(e) => setResetConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl p-2.5 text-xs text-[#2D332A] focus:outline-none focus:border-[#748C70]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-[#D49B4B] hover:bg-[#B88237] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-[0.99] disabled:opacity-60"
            >
              {loading ? (
                <span>جاري تحديث كلمة المرور...</span>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>تحديث كلمة المرور والدخول</span>
                </>
              )}
            </button>
          </form>
        )}

      </div>

      {/* 4. TEMPORARY VISIBLE DIAGNOSTIC LOG PANEL */}
      <div className="mt-4 bg-[#1E241D] text-[#E8E2D6] border border-[#3E473B] rounded-2xl p-3.5 shadow-md text-xs space-y-2">
        <div className="flex items-center justify-between border-b border-[#3E473B] pb-2">
          <div className="flex items-center gap-2 text-[#A8C7A0] font-bold">
            <Terminal className="w-4 h-4 text-[#A8C7A0]" />
            <span>لوحة فحص وتشخيص الاتصال المباشر بالسيرفر السحابي</span>
          </div>
          <button
            type="button"
            onClick={() => setShowDiagPanel(!showDiagPanel)}
            className="text-[10px] text-[#A8C7A0] hover:underline font-semibold"
          >
            {showDiagPanel ? 'إخفاء' : 'إظهار'}
          </button>
        </div>

        {showDiagPanel && (
          <div className="space-y-1.5 font-mono text-[11px] leading-relaxed pt-1 select-text">
            <div className="flex items-start gap-1">
              <span className="text-[#8A9187] shrink-0 font-sans">• رابط الطلب (Login URL):</span>
              <span className="text-amber-300 break-all">{diagData?.loginRequestUrl || 'https://teacher-manager-623166426191.europe-west2.run.app/api/auth/login'}</span>
            </div>

            <div className="flex items-center gap-1">
              <span className="text-[#8A9187] font-sans">• حالة الاستجابة (HTTP Status):</span>
              <span className={`font-bold ${diagData?.httpStatus === 200 ? 'text-emerald-400' : diagData?.httpStatus ? 'text-rose-400' : 'text-gray-400'}`}>
                {diagData?.httpStatus ? `${diagData.httpStatus}` : 'في انتظار المحاولة'}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <span className="text-[#8A9187] font-sans">• نتيجة التحقق (Login Success):</span>
              <span className={`font-bold ${diagData?.loginSuccess ? 'text-emerald-400' : 'text-amber-400'}`}>
                {diagData?.loginSuccess ? 'ناجح (True)' : diagData ? 'فشل (False)' : 'لم يتم البدء'}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <span className="text-[#8A9187] font-sans">• كود المستخدم (Authenticated User ID):</span>
              <span className="text-sky-300">{diagData?.authenticatedUserId || 'غير محدد بعد'}</span>
            </div>

            <div className="flex items-center gap-1">
              <span className="text-[#8A9187] font-sans">• حفظ التوكن محلياً (Token Saved):</span>
              <span className={`font-bold ${diagData?.tokenSaved ? 'text-emerald-400' : 'text-gray-400'}`}>
                {diagData?.tokenSaved ? 'نعم (Saved to Local Storage)' : 'لا'}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <span className="text-[#8A9187] font-sans">• حالة سحب البيانات (Sync Pull Status):</span>
              <span className={`font-bold ${diagData?.syncPullStatus === 200 ? 'text-emerald-400' : 'text-amber-300'}`}>
                {diagData?.syncPullStatus ? `${diagData.syncPullStatus}` : 'لم يطلب بعد'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1 bg-[#262E25] p-2 rounded-xl text-[10px] text-gray-300 border border-[#3E473B]/60">
              <div>👨‍🎓 الطلاب المستلمون: <strong className="text-white">{diagData?.studentsReceived || 0}</strong></div>
              <div>👥 المجموعات المستلمة: <strong className="text-white">{diagData?.groupsReceived || 0}</strong></div>
              <div>📅 الحصص المستلمة: <strong className="text-white">{diagData?.sessionsReceived || 0}</strong></div>
              <div>💵 المدفوعات المستلمة: <strong className="text-white">{diagData?.paymentsReceived || 0}</strong></div>
            </div>

            <div className="flex items-center gap-1 pt-1 border-t border-[#3E473B]">
              <span className="text-[#8A9187] font-sans">• نتيجة الاستعادة (Restore Status):</span>
              <span className={`font-bold ${diagData?.restoreSuccess ? 'text-emerald-400' : diagData ? 'text-amber-400' : 'text-gray-400'}`}>
                {diagData?.restoreSuccess ? 'تمت الاستعادة بنجاح (Restored OK)' : diagData?.restoreMessage || 'جاهز للاختبار'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="text-center text-[11px] text-[#8A9187] mt-4 space-y-0.5">
        <p className="font-semibold">تطبيق Teacher Manager • مزامنة حية مع Firebase Firestore السحابية</p>
      </div>

    </div>
  );
};
