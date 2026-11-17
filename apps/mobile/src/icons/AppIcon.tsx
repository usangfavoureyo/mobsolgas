import type { ComponentType } from "react";
import Svg, { Circle, Path } from "react-native-svg";
import type { SvgProps } from "react-native-svg";
import HomeSolid from "../../assets/icons/hugeroundedicons/home-01-solid-rounded.svg";
import HomeStroke from "../../assets/icons/hugeroundedicons/home-01-stroke-rounded.svg";
import OrdersSolid from "../../assets/icons/hugeroundedicons/bookmark-02-solid-rounded.svg";
import OrdersStroke from "../../assets/icons/hugeroundedicons/bookmark-02-stroke-rounded.svg";
import SupportSolid from "../../assets/icons/hugeroundedicons/bubble-chat-solid-rounded.svg";
import SupportStroke from "../../assets/icons/hugeroundedicons/bubble-chat-stroke-rounded.svg";
import LocationStroke from "../../assets/icons/hugeroundedicons/pin-stroke-rounded.svg";
import ProfileSolid from "../../assets/icons/hugeroundedicons/user-solid-rounded.svg";
import ProfileStroke from "../../assets/icons/hugeroundedicons/user-stroke-rounded.svg";
import SearchStroke from "../../assets/icons/hugeroundedicons/search-01-stroke-rounded.svg";
import CloseStroke from "../../assets/icons/hugeroundedicons/cancel-01-stroke-rounded.svg";
import ArrowStroke from "../../assets/icons/hugeroundedicons/arrow-right-02-stroke-rounded.svg";
import BackStroke from "../../assets/icons/hugeroundedicons/arrow-left-02-stroke-rounded.svg";
import NotificationStroke from "../../assets/icons/hugeroundedicons/notification-01-stroke-rounded.svg";
import CartStroke from "../../assets/icons/hugeroundedicons/shopping-cart-02-stroke-rounded.svg";
import WalletIcon from "../../assets/icons/hugeroundedicons/wallet-minimal-stroke-rounded.svg";
import SafetyIcon from "../../assets/icons/hugeroundedicons/police-badge-stroke-rounded.svg";
import InboxStroke from "../../assets/icons/hugeroundedicons/mail-01-stroke-rounded.svg";
import ReadAllStroke from "../../assets/icons/hugeroundedicons/tick-double-01-stroke-rounded.svg";
import ClockStroke from "../../assets/icons/hugeroundedicons/clock-01-stroke-rounded.svg";
import CalendarStroke from "../../assets/icons/hugeroundedicons/calendar-04-stroke-rounded.svg";
import AppearanceIcon from "../../assets/icons/hugeroundedicons/paint-brush-04-stroke-rounded.svg";
import LegalIcon from "../../assets/icons/hugeroundedicons/book-open-01-stroke-rounded.svg";
import SettingsIcon from "../../assets/icons/hugeroundedicons/settings-03-stroke-rounded.svg";
import InviteIcon from "../../assets/icons/hugeroundedicons/share-04-stroke-rounded.svg";
import DeleteIcon from "../../assets/icons/hugeroundedicons/delete-01-stroke-rounded.svg";
import WithdrawIcon from "../../assets/icons/hugeroundedicons/arrow-down-02-stroke-rounded.svg";
import BriefcaseIcon from "../../assets/icons/hugeroundedicons/briefcase-01-stroke-rounded.svg";
import CreditCardIcon from "../../assets/icons/hugeroundedicons/credit-card-pos-stroke-rounded.svg";
import BankTransferIcon from "../../assets/icons/hugeroundedicons/landmark-stroke-rounded.svg";

export type IconName = "home" | "orders" | "cart" | "support" | "location" | "profile" | "search" | "close" | "arrow" | "notification" | "wallet" | "safety" | "inbox" | "appearance" | "legal" | "settings" | "invite" | "back" | "delete" | "withdraw" | "readAll" | "clock" | "calendar" | "briefcase" | "creditCard" | "bankTransfer";

const iconMap: Record<Exclude<IconName, "cart">, [ComponentType<SvgProps>, ComponentType<SvgProps>]> = {
  home: [HomeSolid, HomeStroke],
  orders: [OrdersSolid, OrdersStroke],
  support: [SupportSolid, SupportStroke],
  location: [LocationStroke, LocationStroke],
  profile: [ProfileSolid, ProfileStroke],
  search: [SearchStroke, SearchStroke],
  close: [CloseStroke, CloseStroke],
  arrow: [ArrowStroke, ArrowStroke],
  back: [BackStroke, BackStroke],
  notification: [NotificationStroke, NotificationStroke],
  wallet: [WalletIcon, WalletIcon],
  safety: [SafetyIcon, SafetyIcon],
  inbox: [InboxStroke, InboxStroke],
  readAll: [ReadAllStroke, ReadAllStroke],
  clock: [ClockStroke, ClockStroke],
  calendar: [CalendarStroke, CalendarStroke],
  appearance: [AppearanceIcon, AppearanceIcon],
  legal: [LegalIcon, LegalIcon],
  settings: [SettingsIcon, SettingsIcon],
  invite: [InviteIcon, InviteIcon],
  delete: [DeleteIcon, DeleteIcon],
  withdraw: [WithdrawIcon, WithdrawIcon],
  briefcase: [BriefcaseIcon, BriefcaseIcon],
  creditCard: [CreditCardIcon, CreditCardIcon],
  bankTransfer: [BankTransferIcon, BankTransferIcon],
};

export function AppIcon({ name, active = false, size = 22, color }: { name: IconName; active?: boolean; size?: number; color: string }) {
  if (name === "cart") {
    if (!active) return <CartStroke width={size} height={size} color={color} />;
    return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8 16L16.7201 15.2733C19.4486 15.046 20.0611 14.45 20.3635 11.7289L21 6H7L8 16Z" fill={color} stroke="none" />
      <Path d="M8 16L16.7201 15.2733C19.4486 15.046 20.0611 14.45 20.3635 11.7289L21 6" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <Path d="M6 6H22" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <Circle cx="6" cy="20" r="2" fill="none" stroke={color} strokeWidth="1.5" /><Circle cx="17" cy="20" r="2" fill="none" stroke={color} strokeWidth="1.5" />
      <Path d="M8 20L15 20" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <Path d="M2 2H2.966C3.91068 2 4.73414 2.62459 4.96326 3.51493L7.93852 15.0765C8.08887 15.6608 7.9602 16.2797 7.58824 16.7616L6.63213 18" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </Svg>;
  }
  const Component = iconMap[name][active ? 0 : 1];
  return <Component width={size} height={size} color={color} />;
}
