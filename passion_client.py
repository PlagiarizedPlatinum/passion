"""
Passion Client
- Frameless, 700x420, fully rounded corners matching login
- F5 (rebindable) toggles via native keyboard hook — works even when hidden
- Screen 0: Key Auth  |  Screen 1: Admin Login  |  Screen 2: Main UI
- Settings in passion_settings.json
"""

import sys, os, json, uuid, platform, hashlib, requests, ctypes, threading
from PyQt5.QtWidgets import (
    QApplication, QWidget, QLabel, QLineEdit, QPushButton,
    QVBoxLayout, QHBoxLayout, QStackedWidget, QFrame,
    QGraphicsDropShadowEffect, QSizePolicy, QScrollArea,
    QCheckBox, QSpacerItem, QAbstractScrollArea
)
from PyQt5.QtCore import Qt, QThread, pyqtSignal, QPoint, QTimer, QRect, QRectF
from PyQt5.QtGui import (
    QFont, QColor, QPalette, QCursor, QPainter,
    QLinearGradient, QRadialGradient, QBrush, QPen, QPainterPath,
    QKeySequence, QRegion, QPixmap
)

# ── CONFIG ─────────────────────────────────────────────────────────────────────
API_BASE      = "https://passionext.vercel.app"
SETTINGS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "passion_settings.json")
WIN_W, WIN_H  = 700, 420
SIDEBAR_W     = 220
RADIUS        = 17   # Match login screen exactly
# ──────────────────────────────────────────────────────────────────────────────


def get_hwid() -> str:
    raw = platform.node() + str(uuid.getnode()) + platform.processor()
    return hashlib.sha256(raw.encode()).hexdigest().upper()[:32]


def load_settings() -> dict:
    defaults = {"hotkey": "F5", "toggle_key": Qt.Key_F5, "saved_key": "", "auto_login": False}
    try:
        with open(SETTINGS_FILE) as f:
            defaults.update(json.load(f))
    except Exception:
        pass
    return defaults


def save_settings(data: dict):
    try:
        with open(SETTINGS_FILE, "w") as f:
            json.dump(data, f, indent=2)
    except Exception:
        pass


def mkfont(px, weight=QFont.Normal):
    f = QFont()
    f.setFamilies(["SF Pro Display", "SF Pro Text", ".AppleSystemUIFont",
                   "Segoe UI", "Helvetica Neue", "Arial"])
    f.setPixelSize(px)
    f.setWeight(weight)
    return f


# ── Colours ────────────────────────────────────────────────────────────────────
C = {
    "bg":        "#0f0b0c",
    "sidebar":   "#191416",
    "content":   "#150f11",
    "border":    "#352f31",
    "red":       "#dc2625",
    "text":      "#e5e3e4",
    "sub":       "#868283",
    "muted":     "#5d585c",
    "input_bg":  "#2a2024",
    "input_bdr": "#352c2f",
    "active_bg": "#211619",
}

INPUT_SS = f"""
QLineEdit {{
    background-color: {C['input_bg']};
    color: #d0cbcc;
    border: 1px solid {C['input_bdr']};
    border-radius: 8px;
    padding: 0 11px;
    font-size: 14px;
}}
QLineEdit:focus {{
    border: 1px solid #5a4f52;
    background-color: #2e2428;
    color: #e5e3e4;
}}
"""

BTN_SS = f"""
QPushButton {{
    background-color: {C['red']};
    color: #ffffff;
    border: none;
    border-radius: 8px;
    font-weight: bold;
    font-size: 14px;
    letter-spacing: 0.2px;
}}
QPushButton:hover   {{ background-color: #e83433; }}
QPushButton:pressed {{ background-color: #b81e1e; }}
QPushButton:disabled{{ background-color: #5a1f1e; color: #7a5555; }}
"""

SCROLL_SS = """
QScrollArea { border: none; background: transparent; }
QScrollBar:vertical {
    background: transparent;
    width: 4px;
    margin: 6px 3px 6px 0;
    border-radius: 2px;
}
QScrollBar::handle:vertical {
    background: #3a2f32;
    border-radius: 2px;
    min-height: 24px;
}
QScrollBar::handle:vertical:hover { background: #dc2625; }
QScrollBar::add-line:vertical,
QScrollBar::sub-line:vertical     { height: 0; }
QScrollBar::add-page:vertical,
QScrollBar::sub-page:vertical     { background: none; }
"""


# ── Native global hotkey (Windows) ─────────────────────────────────────────────
# Maps Qt key codes to Windows VK codes for common keys
QT_TO_VK = {
    Qt.Key_F1: 0x70, Qt.Key_F2: 0x71, Qt.Key_F3: 0x72, Qt.Key_F4: 0x73,
    Qt.Key_F5: 0x74, Qt.Key_F6: 0x75, Qt.Key_F7: 0x76, Qt.Key_F8: 0x77,
    Qt.Key_F9: 0x78, Qt.Key_F10: 0x79, Qt.Key_F11: 0x7A, Qt.Key_F12: 0x7B,
    Qt.Key_Insert: 0x2D, Qt.Key_Delete: 0x2E, Qt.Key_Home: 0x24,
    Qt.Key_End: 0x23, Qt.Key_PageUp: 0x21, Qt.Key_PageDown: 0x22,
}

class GlobalHotkey(QThread):
    """Polls GetAsyncKeyState in a background thread — works even when window hidden."""
    triggered = pyqtSignal()

    def __init__(self):
        super().__init__()
        self.vk   = 0x74  # F5 default
        self._was_down = False
        self._running  = True
        self.setDaemon = True

    def set_key(self, qt_key: int):
        self.vk = QT_TO_VK.get(qt_key, 0x74)

    def run(self):
        if platform.system() != "Windows":
            return  # Only implemented for Windows
        try:
            GetAsyncKeyState = ctypes.windll.user32.GetAsyncKeyState
            while self._running:
                state = GetAsyncKeyState(self.vk)
                is_down = bool(state & 0x8000)
                if is_down and not self._was_down:
                    self.triggered.emit()
                self._was_down = is_down
                self.msleep(20)
        except Exception:
            pass

    def stop(self):
        self._running = False


# ── Workers ────────────────────────────────────────────────────────────────────
class ValidateWorker(QThread):
    done = pyqtSignal(bool, str, object)

    def __init__(self, key, hwid):
        super().__init__()
        self.key, self.hwid = key, hwid

    def run(self):
        try:
            r = requests.post(f"{API_BASE}/api/keys/validate",
                              json={"key": self.key, "hwid": self.hwid}, timeout=10)
            data = r.json()
            if data.get("valid"):
                self.done.emit(True, "", data)
            else:
                msgs = {
                    "invalid_key":      "Invalid key.",
                    "expired":          "This key has expired.",
                    "max_uses_reached": "Key usage limit reached.",
                    "hwid_mismatch":    "Key is locked to another device.",
                }
                self.done.emit(False, msgs.get(data.get("reason",""), "Validation failed."), {})
        except requests.Timeout:
            self.done.emit(False, "Connection timed out.", {})
        except Exception as e:
            self.done.emit(False, f"Network error: {e}", {})


class LoginWorker(QThread):
    done = pyqtSignal(bool, str)

    def __init__(self, username, password):
        super().__init__()
        self.username, self.password = username, password

    def run(self):
        try:
            r = requests.post(f"{API_BASE}/api/auth/login",
                              json={"username": self.username, "password": self.password}, timeout=10)
            if r.ok:
                self.done.emit(True, "")
            else:
                self.done.emit(False, r.json().get("error", "Invalid credentials."))
        except requests.Timeout:
            self.done.emit(False, "Connection timed out.")
        except Exception as e:
            self.done.emit(False, f"Network error: {e}")


# ── Helpers ────────────────────────────────────────────────────────────────────
def lbl(text, px=13, color=None, bold=False) -> QLabel:
    l = QLabel(text)
    l.setFont(mkfont(px, QFont.Bold if bold else QFont.Normal))
    c = color or C["sub"]
    l.setStyleSheet(f"color:{c}; background:transparent; border:none;")
    return l


def make_input(placeholder="", password=False) -> QLineEdit:
    w = QLineEdit()
    w.setPlaceholderText(placeholder)
    w.setFixedHeight(43)
    w.setFont(mkfont(13))
    w.setStyleSheet(INPUT_SS)
    if password:
        w.setEchoMode(QLineEdit.Password)
    return w


def make_btn(text) -> QPushButton:
    b = QPushButton(text)
    b.setFixedHeight(43)
    b.setFont(mkfont(14, QFont.Bold))
    b.setCursor(QCursor(Qt.PointingHandCursor))
    b.setStyleSheet(BTN_SS)
    glow = QGraphicsDropShadowEffect()
    glow.setBlurRadius(24)
    glow.setOffset(0, 0)
    glow.setColor(QColor(220, 38, 37, 140))
    b.setGraphicsEffect(glow)
    return b


def glowing_label(text, px, base_color, glow_color, bold=False) -> QLabel:
    """Label with a text-shadow glow effect via stylesheet."""
    l = QLabel(text)
    l.setFont(mkfont(px, QFont.Bold if bold else QFont.Normal))
    l.setStyleSheet(f"""
        color: {base_color};
        background: transparent;
        border: none;
    """)
    # Add drop shadow for glow
    shadow = QGraphicsDropShadowEffect()
    shadow.setBlurRadius(12)
    shadow.setOffset(0, 0)
    shadow.setColor(QColor(glow_color))
    l.setGraphicsEffect(shadow)
    return l


# ── Avatar ─────────────────────────────────────────────────────────────────────
class AvatarWidget(QWidget):
    def __init__(self, size=38, parent=None):
        super().__init__(parent)
        self.setFixedSize(size, size)
        self._sz = size

    def paintEvent(self, event):
        p = QPainter(self)
        p.setRenderHint(QPainter.Antialiasing)
        s = self._sz
        # Circle bg
        path = QPainterPath()
        path.addEllipse(1, 1, s-2, s-2)
        p.fillPath(path, QBrush(QColor("#1e181a")))
        p.setPen(QPen(QColor("#3a2f32"), 1))
        p.drawPath(path)
        # Person silhouette
        p.setPen(Qt.NoPen)
        p.setBrush(QBrush(QColor("#5a5055")))
        cx = s // 2
        hr = s // 7
        p.drawEllipse(cx - hr, int(s * 0.18), hr*2, hr*2)
        bw = s // 3
        p.drawRoundedRect(cx - bw//2, int(s * 0.48), bw, int(s * 0.32), 3, 3)


# ── Auth Panel ─────────────────────────────────────────────────────────────────
class AuthPanel(QWidget):
    key_success   = pyqtSignal(dict)
    admin_success = pyqtSignal()

    def __init__(self, parent=None):
        super().__init__(parent)
        self.hwid    = get_hwid()
        self._worker = None
        self.setStyleSheet("background:transparent;")
        self._build()

    def _build(self):
        lay = QVBoxLayout(self)
        lay.setContentsMargins(0, 0, 0, 0)
        center = QHBoxLayout()
        center.setAlignment(Qt.AlignCenter)

        self.stack = QStackedWidget()
        self.stack.setFixedSize(340, WIN_H - 40)
        self.stack.setStyleSheet("background:transparent;")
        self.stack.addWidget(self._key_screen())
        self.stack.addWidget(self._login_screen())

        center.addWidget(self.stack)
        lay.addLayout(center)

        # Auto-login: if enabled and key saved, trigger after UI shown
        s = load_settings()
        if s.get("auto_login") and s.get("saved_key"):
            QTimer.singleShot(300, self._auto_login)

    def _auto_login(self):
        s = load_settings()
        key = s.get("saved_key", "").strip()
        if not key:
            return
        self.key_input.setText(key)
        self.key_btn.setEnabled(False)
        self.key_btn.setText("Auto-logging in…")
        self.key_err.hide()
        self._worker = ValidateWorker(key, self.hwid)
        self._worker.done.connect(self._on_validate)
        self._worker.start()

    def _key_screen(self):
        w = QWidget()
        w.setStyleSheet("background:transparent;")
        lay = QVBoxLayout(w)
        lay.setContentsMargins(20, 0, 20, 0)
        lay.setSpacing(0)
        lay.addStretch(1)

        t = glowing_label("Passion", 27, C["text"], "#dc2625aa", bold=True)
        t.setAlignment(Qt.AlignCenter)
        lay.addWidget(t)
        lay.addSpacing(7)

        s = lbl("Enter your license key to continue", 13, C["sub"])
        s.setAlignment(Qt.AlignCenter)
        lay.addWidget(s)
        lay.addSpacing(28)

        lay.addWidget(lbl("License Key", 12, C["muted"]))
        lay.addSpacing(6)
        self.key_input = make_input("PASS-XXXX-XXXX-XXXX-XXXX")
        self.key_input.returnPressed.connect(self._do_validate)
        lay.addWidget(self.key_input)
        lay.addSpacing(6)

        self.key_err = lbl("", 12, C["red"])
        self.key_err.setAlignment(Qt.AlignCenter)
        self.key_err.setWordWrap(True)
        self.key_err.hide()
        lay.addWidget(self.key_err)
        lay.addSpacing(4)

        self.key_btn = make_btn("Activate")
        self.key_btn.clicked.connect(self._do_validate)
        lay.addWidget(self.key_btn)
        lay.addStretch(2)

        row = QHBoxLayout()
        row.setAlignment(Qt.AlignCenter)
        row.setSpacing(4)
        row.addWidget(lbl("Admin?", 12, C["muted"]))
        link = lbl("Login", 12, C["red"])
        link.setCursor(QCursor(Qt.PointingHandCursor))
        link.setStyleSheet(f"color:{C['red']}; text-decoration:underline; background:transparent; border:none;")
        link.mousePressEvent = lambda _: self.stack.setCurrentIndex(1)
        row.addWidget(link)
        lay.addLayout(row)
        return w

    def _login_screen(self):
        w = QWidget()
        w.setStyleSheet("background:transparent;")
        lay = QVBoxLayout(w)
        lay.setContentsMargins(20, 0, 20, 0)
        lay.setSpacing(0)
        lay.addStretch(1)

        t = glowing_label("Passion", 27, C["text"], "#dc2625aa", bold=True)
        t.setAlignment(Qt.AlignCenter)
        lay.addWidget(t)
        lay.addSpacing(7)
        s = lbl("Admin sign in", 13, C["sub"])
        s.setAlignment(Qt.AlignCenter)
        lay.addWidget(s)
        lay.addSpacing(28)

        lay.addWidget(lbl("Username", 12, C["muted"]))
        lay.addSpacing(6)
        self.user_input = make_input()
        lay.addWidget(self.user_input)
        lay.addSpacing(14)

        lay.addWidget(lbl("Password", 12, C["muted"]))
        lay.addSpacing(6)
        self.pass_input = make_input(password=True)
        self.pass_input.returnPressed.connect(self._do_login)
        lay.addWidget(self.pass_input)
        lay.addSpacing(6)

        self.login_err = lbl("", 12, C["red"])
        self.login_err.setAlignment(Qt.AlignCenter)
        self.login_err.setWordWrap(True)
        self.login_err.hide()
        lay.addWidget(self.login_err)
        lay.addSpacing(4)

        self.login_btn = make_btn("Sign In")
        self.login_btn.clicked.connect(self._do_login)
        lay.addWidget(self.login_btn)
        lay.addStretch(2)

        row = QHBoxLayout()
        row.setAlignment(Qt.AlignCenter)
        row.setSpacing(4)
        row.addWidget(lbl("←", 12, C["muted"]))
        back = lbl("Back", 12, C["red"])
        back.setCursor(QCursor(Qt.PointingHandCursor))
        back.setStyleSheet(f"color:{C['red']}; text-decoration:underline; background:transparent; border:none;")
        back.mousePressEvent = lambda _: self.stack.setCurrentIndex(0)
        row.addWidget(back)
        lay.addLayout(row)
        return w

    def _do_validate(self):
        key = self.key_input.text().strip()
        if not key:
            self._kerr("Please enter your license key.")
            return
        self.key_btn.setEnabled(False)
        self.key_btn.setText("Validating…")
        self.key_err.hide()
        self._worker = ValidateWorker(key, self.hwid)
        self._worker.done.connect(self._on_validate)
        self._worker.start()

    def _on_validate(self, ok, err, info):
        self.key_btn.setEnabled(True)
        self.key_btn.setText("Activate")
        if ok:
            info["_key_raw"] = self.key_input.text().strip()
            # Save key if auto_login is on
            s = load_settings()
            if s.get("auto_login"):
                s["saved_key"] = info["_key_raw"]
                save_settings(s)
            self.key_success.emit(info)
        else:
            self._kerr(err)

    def _kerr(self, msg):
        self.key_err.setText(msg)
        self.key_err.show()

    def _do_login(self):
        u, p = self.user_input.text().strip(), self.pass_input.text()
        if not u or not p:
            self._lerr("Enter username and password.")
            return
        self.login_btn.setEnabled(False)
        self.login_btn.setText("Signing in…")
        self.login_err.hide()
        self._worker = LoginWorker(u, p)
        self._worker.done.connect(self._on_login)
        self._worker.start()

    def _on_login(self, ok, err):
        self.login_btn.setEnabled(True)
        self.login_btn.setText("Sign In")
        if ok:
            self.admin_success.emit()
        else:
            self._lerr(err)

    def _lerr(self, msg):
        self.login_err.setText(msg)
        self.login_err.show()


# ── Nav Item ───────────────────────────────────────────────────────────────────
class NavItem(QWidget):
    clicked = pyqtSignal()

    def __init__(self, text, parent=None):
        super().__init__(parent)
        self.text     = text
        self._active  = False
        self._hovered = False
        self.setFixedHeight(42)
        self.setCursor(QCursor(Qt.PointingHandCursor))
        self.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Fixed)

    def setActive(self, v):
        self._active = v
        self.update()

    def paintEvent(self, event):
        p = QPainter(self)
        p.setRenderHint(QPainter.Antialiasing)
        W, H = self.width(), self.height()

        if self._active:
            p.fillRect(0, 0, W, H, QColor(C["active_bg"]))
            # Red left bar
            bar = QPainterPath()
            bar.addRoundedRect(0, 4, 3, H - 8, 1.5, 1.5)
            p.fillPath(bar, QBrush(QColor(C["red"])))
            color = QColor(C["text"])
            # Subtle red glow on text
            shadow = QGraphicsDropShadowEffect()
        elif self._hovered:
            p.fillRect(0, 0, W, H, QColor("#1a1316"))
            color = QColor("#a09aa0")
        else:
            color = QColor(C["muted"])

        p.setPen(color)
        p.setFont(mkfont(14, QFont.Bold if self._active else QFont.Normal))
        p.drawText(QRect(18, 0, W - 18, H), Qt.AlignVCenter | Qt.AlignLeft, self.text)

    def mousePressEvent(self, e):
        self.clicked.emit()

    def enterEvent(self, e):
        self._hovered = True
        self.update()

    def leaveEvent(self, e):
        self._hovered = False
        self.update()


# ── Sidebar ────────────────────────────────────────────────────────────────────
class Sidebar(QWidget):
    nav_changed = pyqtSignal(int)
    NAV = ["Visual", "Movement", "Overpowered", "Skins", "Lua", "Settings"]

    def __init__(self, key_info: dict, parent=None):
        super().__init__(parent)
        self.setFixedWidth(SIDEBAR_W)
        self.key_info = key_info
        self._items   = []
        self._build()

    def _build(self):
        lay = QVBoxLayout(self)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.setSpacing(0)

        # Logo area
        logo_w = QWidget()
        logo_w.setFixedHeight(95)
        logo_w.setStyleSheet("background:transparent;")
        ll = QVBoxLayout(logo_w)
        ll.setAlignment(Qt.AlignCenter)
        ll.setContentsMargins(16, 10, 16, 10)

        logo_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logo.png")
        logo_lbl  = QLabel()
        logo_lbl.setAlignment(Qt.AlignCenter)
        logo_lbl.setStyleSheet("background:transparent; border:none;")
        if os.path.exists(logo_path):
            pix = QPixmap(logo_path)
            logo_lbl.setPixmap(pix.scaled(160, 72, Qt.KeepAspectRatio, Qt.SmoothTransformation))
        else:
            logo_lbl.setText("PASSION")
            logo_lbl.setFont(mkfont(18, QFont.Bold))
            logo_lbl.setStyleSheet(f"color:{C['text']}; background:transparent; border:none;")
            shadow = QGraphicsDropShadowEffect()
            shadow.setBlurRadius(14); shadow.setOffset(0, 0)
            shadow.setColor(QColor(220, 38, 37, 120))
            logo_lbl.setGraphicsEffect(shadow)
        ll.addWidget(logo_lbl)
        lay.addWidget(logo_w)

        lay.addWidget(self._line())

        # Nav
        nav_w = QWidget()
        nav_w.setStyleSheet("background:transparent;")
        nl = QVBoxLayout(nav_w)
        nl.setContentsMargins(0, 6, 0, 6)
        nl.setSpacing(1)
        for i, name in enumerate(self.NAV):
            item = NavItem(name)
            item.clicked.connect(lambda idx=i: self._nav(idx))
            self._items.append(item)
            nl.addWidget(item)
        nl.addStretch()
        lay.addWidget(nav_w, 1)

        lay.addWidget(self._line())
        lay.addWidget(self._user_strip())

    def _line(self):
        f = QFrame()
        f.setFrameShape(QFrame.HLine)
        f.setFixedHeight(1)
        f.setStyleSheet(f"background:{C['border']}; border:none;")
        return f

    def _user_strip(self):
        w = QWidget()
        w.setFixedHeight(58)
        w.setStyleSheet("background:transparent;")
        row = QHBoxLayout(w)
        row.setContentsMargins(12, 0, 12, 0)
        row.setSpacing(10)

        row.addWidget(AvatarWidget(36))

        col = QVBoxLayout()
        col.setSpacing(1)

        raw = self.key_info.get("_key_raw", "")
        display = (raw[:9] + "••••") if raw else "Unknown"
        name_l = QLabel(display)
        name_l.setFont(mkfont(12, QFont.Medium))
        name_l.setStyleSheet(f"color:{C['sub']}; background:transparent; border:none;")

        exp_at = self.key_info.get("expires_at")
        if exp_at:
            from datetime import datetime, timezone
            try:
                exp  = datetime.fromisoformat(exp_at.replace("Z", "+00:00"))
                days = (exp - datetime.now(timezone.utc)).days
                exp_txt = f"Expires: {days} Days" if days >= 0 else "Expired"
            except Exception:
                exp_txt = "Expires: —"
        else:
            exp_txt = "Expires: Unlimited"

        exp_l = QLabel(exp_txt)
        exp_l.setFont(mkfont(10))
        exp_l.setStyleSheet(f"color:{C['muted']}; background:transparent; border:none;")

        col.addWidget(name_l)
        col.addWidget(exp_l)
        row.addLayout(col)
        return w

    def set_active(self, i):
        for j, item in enumerate(self._items):
            item.setActive(j == i)

    def _nav(self, i):
        self.set_active(i)
        self.nav_changed.emit(i)

    def paintEvent(self, event):
        p = QPainter(self)
        p.setRenderHint(QPainter.Antialiasing)
        W, H = self.width(), self.height()
        R = float(RADIUS)

        # Clip: round top-left and bottom-left only (extend right past right edge)
        clip = QPainterPath()
        clip.addRoundedRect(0, 0, W + R + 2, H, R, R)
        p.setClipPath(clip)
        p.fillRect(0, 0, W, H, QColor(C["sidebar"]))
        p.setClipping(False)

        # Right divider
        p.setPen(QPen(QColor(C["border"]), 1))
        p.drawLine(W - 1, 0, W - 1, H)


# ── Rounded content stack ──────────────────────────────────────────────────────
class ContentStack(QStackedWidget):
    def paintEvent(self, event):
        p = QPainter(self)
        p.setRenderHint(QPainter.Antialiasing)
        W, H = self.width(), self.height()
        R = float(RADIUS)

        # Clip: round top-right and bottom-right only (extend left past left edge)
        clip = QPainterPath()
        clip.addRoundedRect(-R - 2, 0, W + R + 2, H, R, R)
        p.setClipPath(clip)
        p.fillRect(0, 0, W, H, QColor(C["content"]))


# ── Scrollable page wrapper ────────────────────────────────────────────────────
def scrolled(inner: QWidget) -> QWidget:
    """Wrap a widget in a scroll area that doesn't fight the rounded corners."""
    scroll = QScrollArea()
    scroll.setWidgetResizable(True)
    scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
    scroll.setVerticalScrollBarPolicy(Qt.ScrollBarAsNeeded)
    scroll.setStyleSheet(SCROLL_SS)
    # Make viewport transparent so ContentStack bg shows through
    scroll.setWidget(inner)
    scroll.viewport().setStyleSheet("background:transparent;")
    scroll.setFrameShape(QScrollArea.NoFrame)

    outer = QWidget()
    outer.setStyleSheet("background:transparent;")
    ol = QVBoxLayout(outer)
    ol.setContentsMargins(0, 0, 0, 0)
    ol.addWidget(scroll)
    return outer


# ── Section helpers ────────────────────────────────────────────────────────────
def section_lbl(text: str) -> QLabel:
    l = QLabel(text)
    l.setFont(mkfont(10, QFont.Bold))
    l.setStyleSheet(
        f"color:{C['muted']}; letter-spacing:2.5px; background:transparent; border:none;"
    )
    return l


def toggle_row(text: str, default=False) -> QWidget:
    w = QWidget()
    w.setStyleSheet("background:transparent;")
    h = QHBoxLayout(w)
    h.setContentsMargins(0, 5, 0, 5)

    l = QLabel(text)
    l.setFont(mkfont(13))
    l.setStyleSheet(f"color:{C['sub']}; background:transparent; border:none;")
    h.addWidget(l)
    h.addStretch()

    cb = QCheckBox()
    cb.setChecked(default)
    cb.setStyleSheet(f"""
        QCheckBox::indicator {{
            width: 17px; height: 17px;
            border-radius: 4px;
            border: 1px solid {C['input_bdr']};
            background: {C['input_bg']};
        }}
        QCheckBox::indicator:checked {{
            background: {C['red']};
            border: 1px solid {C['red']};
        }}
        QCheckBox::indicator:hover {{
            border: 1px solid #5a4f52;
        }}
    """)
    h.addWidget(cb)
    return w


def page_title(text: str) -> QLabel:
    l = QLabel(text)
    l.setFont(mkfont(17, QFont.Bold))
    shadow = QGraphicsDropShadowEffect()
    shadow.setBlurRadius(10)
    shadow.setOffset(0, 0)
    shadow.setColor(QColor(220, 38, 37, 80))
    l.setGraphicsEffect(shadow)
    l.setStyleSheet(f"color:{C['text']}; background:transparent; border:none;")
    return l


# ── Pages ──────────────────────────────────────────────────────────────────────
def visual_page() -> QWidget:
    inner = QWidget()
    inner.setStyleSheet("background:transparent;")
    lay = QVBoxLayout(inner)
    lay.setContentsMargins(26, 24, 26, 24)
    lay.setSpacing(3)
    lay.setAlignment(Qt.AlignTop)

    lay.addWidget(page_title("Visual"))
    lay.addSpacing(14)

    lay.addWidget(section_lbl("ESP"))
    lay.addSpacing(4)
    for t in ["Player ESP", "Box ESP", "Skeleton ESP", "Head Dot",
              "Health Bar", "Distance", "Name Tags", "Snaplines"]:
        lay.addWidget(toggle_row(t))

    lay.addSpacing(14)
    lay.addWidget(section_lbl("RADAR"))
    lay.addSpacing(4)
    for t in ["Minimap Radar", "Show Enemies", "Show Teammates"]:
        lay.addWidget(toggle_row(t))

    lay.addSpacing(14)
    lay.addWidget(section_lbl("MISC"))
    lay.addSpacing(4)
    for t in ["Crosshair", "FOV Circle", "Spectator List", "Watermark"]:
        lay.addWidget(toggle_row(t))

    lay.addStretch()
    return scrolled(inner)


def movement_page() -> QWidget:
    inner = QWidget()
    inner.setStyleSheet("background:transparent;")
    lay = QVBoxLayout(inner)
    lay.setContentsMargins(26, 24, 26, 24)
    lay.setSpacing(3)
    lay.setAlignment(Qt.AlignTop)

    lay.addWidget(page_title("Movement"))
    lay.addSpacing(14)
    lay.addWidget(section_lbl("MOVEMENT"))
    lay.addSpacing(4)
    for t in ["Bunny Hop", "Auto Strafe", "Slide Hack",
              "No Fall Damage", "Fast Ladder", "No Clip", "Speed Hack"]:
        lay.addWidget(toggle_row(t))

    lay.addStretch()
    return scrolled(inner)


def placeholder_page(title: str) -> QWidget:
    inner = QWidget()
    inner.setStyleSheet("background:transparent;")
    lay = QVBoxLayout(inner)
    lay.setContentsMargins(26, 24, 26, 24)
    lay.setAlignment(Qt.AlignTop)

    lay.addWidget(page_title(title))
    lay.addSpacing(16)
    ph = lbl("— Coming soon —", 13, C["muted"])
    lay.addWidget(ph)
    lay.addStretch()
    return inner


def settings_page(win_ref) -> QWidget:
    inner = QWidget()
    inner.setStyleSheet("background:transparent;")
    lay = QVBoxLayout(inner)
    lay.setContentsMargins(26, 24, 26, 24)
    lay.setSpacing(4)
    lay.setAlignment(Qt.AlignTop)

    lay.addWidget(page_title("Settings"))
    lay.addSpacing(18)
    lay.addWidget(section_lbl("HOTKEY"))
    lay.addSpacing(8)

    settings = load_settings()
    hotkey_row = QHBoxLayout()

    hl = lbl("Toggle Visibility", 13, C["sub"])
    hotkey_row.addWidget(hl)
    hotkey_row.addStretch()

    hk_box = QLineEdit(settings.get("hotkey", "F5"))
    hk_box.setFixedSize(88, 32)
    hk_box.setFont(mkfont(12))
    hk_box.setStyleSheet(INPUT_SS)
    hk_box.setReadOnly(True)
    hk_box.setAlignment(Qt.AlignCenter)

    recording = [False]

    def on_click(e):
        recording[0] = True
        hk_box.setText("Press key…")
        hk_box.setStyleSheet(INPUT_SS.replace(C['input_bdr'], C['red']))

    def on_key(e):
        if not recording[0]:
            return
        k    = e.key()
        name = QKeySequence(k).toString()
        if name and k != Qt.Key_Escape:
            hk_box.setText(name)
            recording[0] = False
            hk_box.setStyleSheet(INPUT_SS)
            s = load_settings()
            s["hotkey"]     = name
            s["toggle_key"] = k
            save_settings(s)
            win_ref.update_hotkey(k)

    hk_box.mousePressEvent = on_click
    hk_box.keyPressEvent   = on_key
    hotkey_row.addWidget(hk_box)

    rw = QWidget()
    rw.setStyleSheet("background:transparent;")
    rw.setLayout(hotkey_row)
    lay.addWidget(rw)

    lay.addSpacing(6)
    hint = lbl("Click the box then press any key to rebind", 11, C["muted"])
    lay.addWidget(hint)

    lay.addSpacing(22)
    lay.addWidget(section_lbl("AUTO LOGIN"))
    lay.addSpacing(8)

    # Auto login toggle row
    autologin_row = QHBoxLayout()
    al_lbl = lbl("Save key & auto login on startup", 13, C["sub"])
    autologin_row.addWidget(al_lbl)
    autologin_row.addStretch()

    al_cb = QCheckBox()
    s_now  = load_settings()
    al_cb.setChecked(bool(s_now.get("auto_login", False)))
    al_cb.setStyleSheet(f"""
        QCheckBox::indicator {{
            width: 17px; height: 17px; border-radius: 4px;
            border: 1px solid {C['input_bdr']}; background: {C['input_bg']};
        }}
        QCheckBox::indicator:checked {{ background: {C['red']}; border: 1px solid {C['red']}; }}
        QCheckBox::indicator:hover   {{ border: 1px solid #5a4f52; }}
    """)

    def on_autologin_toggle(state):
        s = load_settings()
        s["auto_login"] = bool(state)
        if not bool(state):
            s["saved_key"] = ""   # clear saved key when disabling
        save_settings(s)

    al_cb.stateChanged.connect(on_autologin_toggle)
    autologin_row.addWidget(al_cb)

    al_rw = QWidget()
    al_rw.setStyleSheet("background:transparent;")
    al_rw.setLayout(autologin_row)
    lay.addWidget(al_rw)

    lay.addSpacing(4)
    al_hint = lbl("When enabled, your key is saved locally and used to log in automatically.", 11, C["muted"])
    al_hint.setWordWrap(True)
    lay.addWidget(al_hint)

    lay.addSpacing(10)
    clear_btn = QPushButton("Clear Saved Key")
    clear_btn.setFixedHeight(32)
    clear_btn.setFont(mkfont(12))
    clear_btn.setCursor(QCursor(Qt.PointingHandCursor))
    clear_btn.setStyleSheet(f"""
        QPushButton {{
            background: transparent; color: {C['muted']};
            border: 1px solid #2a2226; border-radius: 6px; font-size: 12px;
        }}
        QPushButton:hover {{ color: {C['red']}; border-color: #dc262544; background: #dc262510; }}
    """)
    def on_clear():
        s = load_settings()
        s["saved_key"] = ""
        save_settings(s)
        al_cb.setChecked(False)
    clear_btn.clicked.connect(on_clear)
    lay.addWidget(clear_btn)

    lay.addStretch()
    return inner


# ── Main UI ────────────────────────────────────────────────────────────────────
class MainUI(QWidget):
    def __init__(self, key_info: dict, win_ref, parent=None):
        super().__init__(parent)
        self.setStyleSheet("background:transparent;")
        root = QHBoxLayout(self)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(0)

        self.sidebar = Sidebar(key_info)
        self.sidebar.nav_changed.connect(self._nav)
        root.addWidget(self.sidebar)

        self.content = ContentStack()
        self.content.setStyleSheet("background:transparent;")

        pages = [
            visual_page(),
            movement_page(),
            placeholder_page("Overpowered"),
            placeholder_page("Skins"),
            placeholder_page("Lua"),
            settings_page(win_ref),
        ]
        for pg in pages:
            self.content.addWidget(pg)

        root.addWidget(self.content, 1)
        self.sidebar.set_active(0)

    def _nav(self, i):
        self.content.setCurrentIndex(i)


# ── Main Window ────────────────────────────────────────────────────────────────
class PassionWindow(QWidget):
    _toggle_signal = pyqtSignal()   # cross-thread safe toggle

    def __init__(self):
        super().__init__()
        self.settings  = load_settings()
        self._dragging = False
        self._drag_pos = QPoint()

        self.setWindowFlags(Qt.FramelessWindowHint | Qt.WindowStaysOnTopHint | Qt.Tool)
        self.setAttribute(Qt.WA_TranslucentBackground, True)
        self.setAttribute(Qt.WA_NoSystemBackground, True)
        self.setFixedSize(WIN_W, WIN_H)

        screen = QApplication.primaryScreen().geometry()
        self.move((screen.width() - WIN_W) // 2, (screen.height() - WIN_H) // 2)

        # Stack
        self.stack = QStackedWidget(self)
        self.stack.setGeometry(0, 0, WIN_W, WIN_H)
        self.stack.setStyleSheet("background:transparent;")

        self.auth = AuthPanel()
        self.auth.key_success.connect(self._on_key)
        self.auth.admin_success.connect(self._on_admin)
        self.stack.addWidget(self.auth)
        self._main = None

        # Connect toggle signal (so hotkey thread can safely call show/hide)
        self._toggle_signal.connect(self._toggle)

        # Start native hotkey thread
        self._hotkey = GlobalHotkey()
        self._hotkey.set_key(self.settings.get("toggle_key", Qt.Key_F5))
        self._hotkey.triggered.connect(self._toggle)
        self._hotkey.start()

    # ── Paint: full rounded window + glow border ──────────────────────────────
    def paintEvent(self, event):
        p = QPainter(self)
        p.setRenderHint(QPainter.Antialiasing)
        W, H = self.width(), self.height()
        R = float(RADIUS)

        p.setCompositionMode(QPainter.CompositionMode_Clear)
        p.fillRect(0, 0, W, H, Qt.transparent)
        p.setCompositionMode(QPainter.CompositionMode_SourceOver)

        path = QPainterPath()
        path.addRoundedRect(1.0, 1.0, W - 2.0, H - 2.0, R, R)

        # Fill
        p.fillPath(path, QBrush(QColor(C["bg"])))

        # Outer red glow
        p.setPen(QPen(QColor(180, 28, 28, 55), 3.5))
        p.drawPath(path)

        # Mid border
        mid = QPainterPath()
        mid.addRoundedRect(1.5, 1.5, W - 3.0, H - 3.0, R - 0.5, R - 0.5)
        p.setPen(QPen(QColor(C["border"]), 1.0))
        p.drawPath(mid)

        # Inner top highlight
        hi = QPainterPath()
        hi.addRoundedRect(2.5, 2.5, W - 5.0, H - 5.0, R - 1.5, R - 1.5)
        p.setPen(QPen(QColor(255, 255, 255, 8), 1.0))
        p.drawPath(hi)

    def _on_key(self, info):
        self._load_main(info)

    def _on_admin(self):
        self._load_main({"_key_raw": "ADMIN", "expires_at": None})

    def _load_main(self, info):
        if self._main:
            self.stack.removeWidget(self._main)
            self._main.deleteLater()
        self._main = MainUI(info, self)
        self.stack.addWidget(self._main)
        self.stack.setCurrentWidget(self._main)

    def update_hotkey(self, key: int):
        self.settings["toggle_key"] = key
        self._hotkey.set_key(key)

    def _toggle(self):
        if self.isVisible():
            self.hide()
        else:
            self.show()
            self.activateWindow()
            self.raise_()

    # Fallback: also catch F5 via keyPressEvent when window is focused
    def keyPressEvent(self, event):
        toggle = self.settings.get("toggle_key", Qt.Key_F5)
        if event.key() == toggle:
            self._toggle()
        super().keyPressEvent(event)

    def mousePressEvent(self, e):
        if e.button() == Qt.LeftButton:
            self._dragging = True
            self._drag_pos = e.globalPos() - self.frameGeometry().topLeft()

    def mouseMoveEvent(self, e):
        if self._dragging and e.buttons() & Qt.LeftButton:
            self.move(e.globalPos() - self._drag_pos)

    def mouseReleaseEvent(self, e):
        self._dragging = False

    def closeEvent(self, e):
        self._hotkey.stop()
        super().closeEvent(e)


# ── Entry ──────────────────────────────────────────────────────────────────────
def main():
    app = QApplication(sys.argv)
    app.setStyle("Fusion")

    pal = QPalette()
    pal.setColor(QPalette.Window,          QColor(C["bg"]))
    pal.setColor(QPalette.WindowText,      QColor(C["text"]))
    pal.setColor(QPalette.Base,            QColor(C["input_bg"]))
    pal.setColor(QPalette.Text,            QColor("#d0cbcc"))
    pal.setColor(QPalette.Button,          QColor(C["sidebar"]))
    pal.setColor(QPalette.ButtonText,      QColor(C["text"]))
    pal.setColor(QPalette.Highlight,       QColor(C["red"]))
    pal.setColor(QPalette.HighlightedText, QColor("#ffffff"))
    app.setPalette(pal)

    win = PassionWindow()
    win.show()
    sys.exit(app.exec_())


if __name__ == "__main__":
    main()
