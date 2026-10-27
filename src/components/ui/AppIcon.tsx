import React from 'react';
import {
  Archive,
  ArrowCounterClockwise,
  ArrowDownLeft,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowsClockwise,
  ArrowUpRight,
  Bell,
  BookOpen,
  Buildings,
  CalendarBlank,
  CalendarCheck,
  CalendarDots,
  CaretDown,
  CaretLeft,
  CaretRight,
  CaretUp,
  Chalkboard,
  ChartBar,
  ChartPieSlice,
  ChatCircleDots,
  Check,
  CheckCircle,
  Checks,
  CheckSquare,
  Clock,
  CloudCheck,
  Coins,
  CreditCard,
  Crown,
  CurrencyDollar,
  Database,
  Diamond,
  DownloadSimple,
  EnvelopeSimple,
  Eye,
  EyeSlash,
  FileText,
  Flame,
  FloppyDisk,
  Funnel,
  Gear,
  Globe,
  GraduationCap,
  Info,
  Key,
  Lightning,
  ListBullets,
  Lock,
  MagnifyingGlass,
  MapPin,
  Medal,
  Minus,
  Moon,
  PencilSimple,
  Percent,
  Phone,
  Plus,
  PlusCircle,
  Printer,
  Pulse,
  Receipt,
  ShareNetwork,
  Shield,
  ShieldCheck,
  ShieldWarning,
  SignOut,
  SlidersHorizontal,
  Sparkle,
  SpeakerHigh,
  SquaresFour,
  Stack,
  Star,
  Sun,
  Tag,
  Trash,
  Translate,
  TrendDown,
  TrendUp,
  Trophy,
  UploadSimple,
  User,
  UserCheck,
  UserPlus,
  UsersThree,
  Wallet,
  Warning,
  WarningCircle,
  WhatsappLogo,
  WifiHigh,
  WifiSlash,
  X,
  XCircle,
  type Icon,
} from '@phosphor-icons/react';

export const ICON_MAP = {
  home: SquaresFour,
  sessions: CalendarBlank,
  reports: ChartBar,
  student: User,
  user: User,
  students: UsersThree,
  group: UsersThree,
  groups: UsersThree,
  bell: Bell,
  settings: Gear,
  plus: Plus,
  plusCircle: PlusCircle,
  minus: Minus,
  search: MagnifyingGlass,
  clock: Clock,
  check: Check,
  checkCircle: CheckCircle,
  close: X,
  chevronStart: CaretLeft,
  chevronEnd: CaretRight,
  wallet: Wallet,
  coins: Coins,
  receipt: Receipt,
  teacher: Chalkboard,
  book: BookOpen,
  edit: PencilSimple,
  trash: Trash,
  archive: Archive,
  info: Info,
  warning: Warning,
  calendarCheck: CalendarCheck,
  fileText: FileText,
  sync: ArrowsClockwise,
  wifiOff: WifiSlash,
  logout: SignOut,
  language: Translate,
  lock: Lock,
  // Additional screen icons
  layers: Stack,
  userPlus: UserPlus,
  userCheck: UserCheck,
  sparkles: Sparkle,
  calendar: CalendarBlank,
  calendarDays: CalendarDots,
  checkSquare: CheckSquare,
  checkAll: Checks,
  printer: Printer,
  share: ShareNetwork,
  filter: Funnel,
  sliders: SlidersHorizontal,
  phone: Phone,
  whatsapp: WhatsappLogo,
  message: ChatCircleDots,
  mail: EnvelopeSimple,
  building: Buildings,
  school: GraduationCap,
  mapPin: MapPin,
  dollar: CurrencyDollar,
  creditCard: CreditCard,
  trendUp: TrendUp,
  arrowUpRight: ArrowUpRight,
  arrowDownLeft: ArrowDownLeft,
  arrowLeft: ArrowLeft,
  arrowRight: ArrowRight,
  chevronDown: CaretDown,
  chevronUp: CaretUp,
  chevronLeft: CaretLeft,
  chevronRight: CaretRight,
  save: FloppyDisk,
  download: DownloadSimple,
  upload: UploadSimple,
  cloudCheck: CloudCheck,
  database: Database,
  wifi: WifiHigh,
  activity: Pulse,
  zap: Lightning,
  globe: Globe,
  shield: ShieldCheck,
  key: Key,
  volume: SpeakerHigh,
  award: Trophy,
  medal: Medal,
  crown: Crown,
  star: Star,
  sparkle: Sparkle,
  flame: Flame,
  diamond: Diamond,
  gem: Diamond,
  shieldCheck: ShieldCheck,
  shieldAlert: ShieldWarning,
  shieldWarning: ShieldWarning,
  trendDown: TrendDown,
  trendingUp: TrendUp,
  trendingDown: TrendDown,
  arrowDownRight: ArrowDownRight,
  currencyDollar: CurrencyDollar,
  dollarSign: CurrencyDollar,
  warningCircle: WarningCircle,
  alertCircle: WarningCircle,
  arrowsClockwise: ArrowsClockwise,
  pencilSimple: PencilSimple,
  edit2: PencilSimple,
  trash2: Trash,
  percent: Percent,
  checkCircle2: CheckCircle,
  xCircle: XCircle,
  calendarRange: CalendarDots,
  calendarCheck2: CalendarCheck,
  barChart3: ChartBar,
  tag: Tag,
  messageCircle: ChatCircleDots,
  invoice: Receipt,
  refresh: ArrowsClockwise,
  pieChart: ChartPieSlice,
  list: ListBullets,
  restore: ArrowCounterClockwise,
  eye: Eye,
  eyeOff: EyeSlash,
  moon: Moon,
  sun: Sun,
} satisfies Record<string, Icon>;

export type AppIconName = keyof typeof ICON_MAP;
export type AppIconWeight = 'fill' | 'duotone' | 'regular';

const AUTO_MIRROR_RTL_NAMES = new Set<AppIconName>(['chevronStart', 'chevronEnd']);

export interface AppIconProps extends Omit<React.SVGProps<SVGSVGElement>, 'name' | 'weight'> {
  name: AppIconName;
  weight?: AppIconWeight;
  size?: number | string;
  mirrorRtl?: boolean;
  active?: boolean;
  className?: string;
}

/**
 * Harbor Mint Icon System (Phosphor Icons)
 * - Navigation + header + quick-action icons: weight="fill"
 * - Tile and list icons: weight="duotone"
 * - Inline text icons: weight="regular"
 * - Default color: inherit (currentColor). When `active` is provided: active -> text-navy, inactive -> text-fog.
 */
export const AppIcon: React.FC<AppIconProps> = ({
  name,
  weight = 'regular',
  size = 24,
  mirrorRtl,
  active,
  className = '',
  color = 'currentColor',
  ...rest
}) => {
  const IconComponent = ICON_MAP[name];
  if (!IconComponent) return null;

  const shouldMirrorRtl = mirrorRtl ?? AUTO_MIRROR_RTL_NAMES.has(name);
  const stateColorClass =
    active === undefined ? '' : active ? 'text-navy' : 'text-fog';
  const rtlClass = shouldMirrorRtl ? 'rtl:-scale-x-100' : '';
  const combinedClassName = ['shrink-0', stateColorClass, rtlClass, className]
    .filter(Boolean)
    .join(' ');

  return (
    <IconComponent
      weight={weight}
      size={size}
      color={color}
      className={combinedClassName}
      {...rest}
    />
  );
};

export default AppIcon;
