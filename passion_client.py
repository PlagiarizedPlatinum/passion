"""
Passion - PyQt5 Client
----------------------
Screen 1 (default): Key Auth  — user enters a license key
Screen 2 (admin):   Login     — admin enters username + password
                               (reached via "Login" link at bottom of key auth)

Set your API base URL below before distributing.
"""

import sys
import uuid
import platform
import hashlib
import requests
from PyQt5.QtWidgets import (
    QApplication, QWidget, QLabel, QLineEdit,
    QPushButton, QVBoxLayout, QHBoxLayout,
    QGraphicsDropShadowEffect, QStackedWidget,
    QSizePolicy
)
from PyQt5.QtCore import Qt, QThread, pyqtSignal
from PyQt5.QtGui import (
    QFont, QColor, QPalette, QCursor, QPainter,
    QRadialGradient, QLinearGradient, QBrush,
    QPen, QPainterPath
)

# ── CONFIG ────────────────────────────────────────────────────────────────────
API_BASE = "https://your-passion-app.vercel.app"   # ← change this
# ─────────────────────────────────────────────────────────────────────────────


def get_hwid() -> str:
    """Generate a stable machine identifier."""
    raw = platform.node() + str(uuid.getnode()) + platform.processor()
    return hashlib.sha256(raw.encode()).hexdigest().upper()[:32]


def mkfont(px: int, weight=QFont.Normal) -> QFont:
    f = QFont()
    f.setFamilies(["SF Pro Display", "SF Pro Text", ".AppleSystemUIFont",
                   "Segoe UI", "Helvetica Neue", "Arial"])
    f.setPixelSize(px)
    f.setWeight(weight)
    return f


# ── Background ────────────────────────────────────────────────────────────────
class BgWidget(QWidget):
    def paintEvent(self, event):
        p = QPainter(self)
        p.setRenderHint(QPainter.Antialiasing)
        W, H = self.width(), self.height()
        p.fillRect(0, 0, W, H, QColor("#0f0b0c"))
        g = QRadialGradient(W * 0.435, H * 0.453, W * 0.38)
        g.setColorAt(0.00, QColor(47, 38, 43, 130))
        g.setColorAt(0.35, QColor(20, 14, 17,  80))
        g.setColorAt(0.70, QColor(10,  8,  9,  30))
        g.setColorAt(1.00, QColor(0,   0,  0,   0))
        p.fillRect(0, 0, W, H, QBrush(g))


# ── Card ──────────────────────────────────────────────────────────────────────
class CardWidget(QWidget):
    def paintEvent(self, event):
        p = QPainter(self)
        p.setRenderHint(QPainter.Antialiasing)
        W, H = self.width(), self.height()
        R = 17.0
        path = QPainterPath()
        path.addRoundedRect(0.5, 0.5, W - 1.0, H - 1.0, R, R)
        fill = QLinearGradient(0, 0, 0, H)
        fill.setColorAt(0.0, QColor("#21161a"))
        fill.setColorAt(1.0, QColor("#161014"))
        p.fillPath(path, QBrush(fill))
        p.setPen(QPen(QColor("#352f31"), 1.0))
        p.drawPath(path)
        hi = QPainterPath()
        hi.addRoundedRect(1.5, 1.5, W - 3.0, H - 3.0, R - 1, R - 1)
        p.setPen(QPen(QColor(255, 255, 255, 10), 1.0))
        p.drawPath(hi)


INPUT_SS = """
QLineEdit {
    background-color: #2a2024;
    color: #c5c0c2;
    border: 1px solid #352c2f;
    border-radius: 8px;
    padding: 0 11px;
    font-size: 14px;
    selection-background-color: #dc2625;
}
QLineEdit:focus {
    border: 1px solid #4e4447;
    background-color: #2e2428;
}
"""

BTN_SS = """
QPushButton {
    background-color: #dc2625;
    color: #ffffff;
    border: none;
    border-radius: 8px;
    font-weight: bold;
    font-size: 14px;
}
QPushButton:hover   { background-color: #e42d2c; }
QPushButton:pressed { background-color: #c41f1e; }
QPushButton:disabled{ background-color: #5a1f1e; color: #888; }
"""

LINK_SS = "color:#cc2020; background:transparent; border:none; text-decoration:underline;"
MUTED_SS = "color:#5d585c; background:transparent; border:none;"
LBL_SS   = "color:#888485; background:transparent; border:none;"


# ── Worker threads ────────────────────────────────────────────────────────────
class ValidateWorker(QThread):
    done = pyqtSignal(bool, str)

    def __init__(self, key: str, hwid: str):
        super().__init__()
        self.key  = key
        self.hwid = hwid

    def run(self):
        try:
            r = requests.post(
                f"{API_BASE}/api/keys/validate",
                json={"key": self.key, "hwid": self.hwid},
                timeout=10,
                headers={"Content-Type": "application/json"}
            )
            data = r.json()
            if data.get("valid"):
                self.done.emit(True, "")
            else:
                reason_map = {
                    "invalid_key":      "Invalid key.",
                    "expired":          "This key has expired.",
                    "max_uses_reached": "Key usage limit reached.",
                    "hwid_mismatch":    "Key is locked to another device.",
                }
                self.done.emit(False, reason_map.get(data.get("reason", ""), "Validation failed."))
        except requests.Timeout:
            self.done.emit(False, "Connection timed out.")
        except Exception as e:
            self.done.emit(False, f"Network error: {e}")


class LoginWorker(QThread):
    done = pyqtSignal(bool, str)

    def __init__(self, username: str, password: str):
        super().__init__()
        self.username = username
        self.password = password

    def run(self):
        try:
            r = requests.post(
                f"{API_BASE}/api/auth/login",
                json={"username": self.username, "password": self.password},
                timeout=10,
                headers={"Content-Type": "application/json"}
            )
            if r.ok:
                self.done.emit(True, "")
            else:
                self.done.emit(False, r.json().get("error", "Invalid credentials."))
        except requests.Timeout:
            self.done.emit(False, "Connection timed out.")
        except Exception as e:
            self.done.emit(False, f"Network error: {e}")


# ── Main window ───────────────────────────────────────────────────────────────
class PassionApp(BgWidget):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Passion")
        self.setFixedSize(889, 824)
        self.hwid = get_hwid()
        self._worker = None
        self._build_ui()

    def _build_ui(self):
        outer = QVBoxLayout(self)
        outer.setAlignment(Qt.AlignCenter)
        outer.setContentsMargins(0, 0, 0, 0)

        self.stack = QStackedWidget()
        self.stack.setFixedSize(358, 390)

        # Build both screens
        self.key_screen   = self._make_key_screen()
        self.login_screen = self._make_login_screen()
        self.stack.addWidget(self.key_screen)   # index 0
        self.stack.addWidget(self.login_screen) # index 1

        # Wrap stack in a CardWidget
        self.card = CardWidget()
        self.card.setFixedSize(358, 390)
        card_lay = QVBoxLayout(self.card)
        card_lay.setContentsMargins(0, 0, 0, 0)
        card_lay.addWidget(self.stack)

        shadow = QGraphicsDropShadowEffect()
        shadow.setBlurRadius(55)
        shadow.setOffset(0, 12)
        shadow.setColor(QColor(0, 0, 0, 210))
        self.card.setGraphicsEffect(shadow)

        outer.addWidget(self.card)

    # ── Key Auth Screen ──────────────────────────────────────────────────────
    def _make_key_screen(self) -> QWidget:
        w = QWidget()
        lay = QVBoxLayout(w)
        lay.setContentsMargins(34, 32, 34, 28)
        lay.setSpacing(0)

        title = QLabel("Passion")
        title.setAlignment(Qt.AlignCenter)
        title.setFont(mkfont(26, QFont.Bold))
        title.setStyleSheet("color:#e5e3e4; background:transparent; border:none;")
        lay.addWidget(title)

        lay.addSpacing(8)

        sub = QLabel("Enter your license key to continue")
        sub.setAlignment(Qt.AlignCenter)
        sub.setFont(mkfont(13))
        sub.setStyleSheet("color:#868283; background:transparent; border:none;")
        lay.addWidget(sub)

        lay.addSpacing(28)

        lbl = QLabel("License Key")
        lbl.setFont(mkfont(13, QFont.Medium))
        lbl.setStyleSheet(LBL_SS)
        lay.addWidget(lbl)

        lay.addSpacing(7)

        self.key_input = QLineEdit()
        self.key_input.setPlaceholderText("PASS-XXXX-XXXX-XXXX-XXXX")
        self.key_input.setFixedHeight(43)
        self.key_input.setFont(mkfont(13))
        self.key_input.setStyleSheet(INPUT_SS)
        self.key_input.returnPressed.connect(self._do_validate)
        lay.addWidget(self.key_input)

        lay.addSpacing(22)

        self.key_error = QLabel("")
        self.key_error.setAlignment(Qt.AlignCenter)
        self.key_error.setFont(mkfont(12))
        self.key_error.setStyleSheet("color:#dc2625; background:transparent; border:none;")
        self.key_error.setWordWrap(True)
        self.key_error.hide()
        lay.addWidget(self.key_error)

        self.key_btn = QPushButton("Activate")
        self.key_btn.setFixedHeight(43)
        self.key_btn.setFont(mkfont(14, QFont.Bold))
        self.key_btn.setCursor(QCursor(Qt.PointingHandCursor))
        self.key_btn.setStyleSheet(BTN_SS)
        # Glow effect
        glow = QGraphicsDropShadowEffect()
        glow.setBlurRadius(22)
        glow.setOffset(0, 0)
        glow.setColor(QColor(220, 38, 37, 140))
        self.key_btn.setGraphicsEffect(glow)
        self.key_btn.clicked.connect(self._do_validate)
        lay.addWidget(self.key_btn)

        lay.addSpacing(18)

        # Bottom row
        row = QHBoxLayout()
        row.setAlignment(Qt.AlignCenter)
        row.setSpacing(4)

        dont = QLabel("Admin?")
        dont.setFont(mkfont(13))
        dont.setStyleSheet(MUTED_SS)

        login_link = QLabel("Login")
        login_link.setFont(mkfont(13))
        login_link.setStyleSheet(LINK_SS)
        login_link.setCursor(QCursor(Qt.PointingHandCursor))
        login_link.mousePressEvent = lambda _: self._goto(1)

        row.addWidget(dont)
        row.addWidget(login_link)
        lay.addLayout(row)

        return w

    # ── Admin Login Screen ───────────────────────────────────────────────────
    def _make_login_screen(self) -> QWidget:
        w = QWidget()
        lay = QVBoxLayout(w)
        lay.setContentsMargins(34, 32, 34, 28)
        lay.setSpacing(0)

        title = QLabel("Passion")
        title.setAlignment(Qt.AlignCenter)
        title.setFont(mkfont(26, QFont.Bold))
        title.setStyleSheet("color:#e5e3e4; background:transparent; border:none;")
        lay.addWidget(title)

        lay.addSpacing(8)

        sub = QLabel("Admin sign in")
        sub.setAlignment(Qt.AlignCenter)
        sub.setFont(mkfont(13))
        sub.setStyleSheet("color:#868283; background:transparent; border:none;")
        lay.addWidget(sub)

        lay.addSpacing(24)

        ul = QLabel("Username")
        ul.setFont(mkfont(13, QFont.Medium))
        ul.setStyleSheet(LBL_SS)
        lay.addWidget(ul)

        lay.addSpacing(7)

        self.user_input = QLineEdit()
        self.user_input.setFixedHeight(43)
        self.user_input.setFont(mkfont(13))
        self.user_input.setStyleSheet(INPUT_SS)
        lay.addWidget(self.user_input)

        lay.addSpacing(16)

        pl = QLabel("Password")
        pl.setFont(mkfont(13, QFont.Medium))
        pl.setStyleSheet(LBL_SS)
        lay.addWidget(pl)

        lay.addSpacing(7)

        self.pass_input = QLineEdit()
        self.pass_input.setEchoMode(QLineEdit.Password)
        self.pass_input.setFixedHeight(43)
        self.pass_input.setFont(mkfont(13))
        self.pass_input.setStyleSheet(INPUT_SS)
        self.pass_input.returnPressed.connect(self._do_login)
        lay.addWidget(self.pass_input)

        lay.addSpacing(10)

        self.login_error = QLabel("")
        self.login_error.setAlignment(Qt.AlignCenter)
        self.login_error.setFont(mkfont(12))
        self.login_error.setStyleSheet("color:#dc2625; background:transparent; border:none;")
        self.login_error.setWordWrap(True)
        self.login_error.hide()
        lay.addWidget(self.login_error)

        lay.addSpacing(4)

        self.login_btn = QPushButton("Sign In")
        self.login_btn.setFixedHeight(43)
        self.login_btn.setFont(mkfont(14, QFont.Bold))
        self.login_btn.setCursor(QCursor(Qt.PointingHandCursor))
        self.login_btn.setStyleSheet(BTN_SS)
        glow = QGraphicsDropShadowEffect()
        glow.setBlurRadius(22)
        glow.setOffset(0, 0)
        glow.setColor(QColor(220, 38, 37, 140))
        self.login_btn.setGraphicsEffect(glow)
        self.login_btn.clicked.connect(self._do_login)
        lay.addWidget(self.login_btn)

        lay.addSpacing(18)

        row = QHBoxLayout()
        row.setAlignment(Qt.AlignCenter)
        row.setSpacing(4)

        back_lbl = QLabel("←")
        back_lbl.setFont(mkfont(13))
        back_lbl.setStyleSheet(MUTED_SS)

        back_link = QLabel("Back to key auth")
        back_link.setFont(mkfont(13))
        back_link.setStyleSheet(LINK_SS)
        back_link.setCursor(QCursor(Qt.PointingHandCursor))
        back_link.mousePressEvent = lambda _: self._goto(0)

        row.addWidget(back_lbl)
        row.addWidget(back_link)
        lay.addLayout(row)

        return w

    # ── Navigation ───────────────────────────────────────────────────────────
    def _goto(self, index: int):
        self._clear_errors()
        self.stack.setCurrentIndex(index)

    def _clear_errors(self):
        self.key_error.hide()
        self.key_error.setText("")
        self.login_error.hide()
        self.login_error.setText("")

    # ── Key Validation ───────────────────────────────────────────────────────
    def _do_validate(self):
        key = self.key_input.text().strip()
        if not key:
            self._show_key_error("Please enter your license key.")
            return
        self.key_btn.setEnabled(False)
        self.key_btn.setText("Validating…")
        self.key_error.hide()

        self._worker = ValidateWorker(key, self.hwid)
        self._worker.done.connect(self._on_validate)
        self._worker.start()

    def _on_validate(self, success: bool, error: str):
        self.key_btn.setEnabled(True)
        self.key_btn.setText("Activate")
        if success:
            self._on_key_success()
        else:
            self._show_key_error(error)

    def _show_key_error(self, msg: str):
        self.key_error.setText(msg)
        self.key_error.show()

    def _on_key_success(self):
        # TODO: open your main application window here
        from PyQt5.QtWidgets import QMessageBox
        QMessageBox.information(self, "Passion", "Key validated! Launch your app here.")

    # ── Admin Login ──────────────────────────────────────────────────────────
    def _do_login(self):
        username = self.user_input.text().strip()
        password = self.pass_input.text()
        if not username or not password:
            self._show_login_error("Please enter username and password.")
            return
        self.login_btn.setEnabled(False)
        self.login_btn.setText("Signing in…")
        self.login_error.hide()

        self._worker = LoginWorker(username, password)
        self._worker.done.connect(self._on_login)
        self._worker.start()

    def _on_login(self, success: bool, error: str):
        self.login_btn.setEnabled(True)
        self.login_btn.setText("Sign In")
        if success:
            self._on_login_success()
        else:
            self._show_login_error(error)

    def _show_login_error(self, msg: str):
        self.login_error.setText(msg)
        self.login_error.show()

    def _on_login_success(self):
        # TODO: open your admin dashboard / main window
        from PyQt5.QtWidgets import QMessageBox
        QMessageBox.information(self, "Passion", "Admin login successful!")


def main():
    app = QApplication(sys.argv)
    app.setStyle("Fusion")

    pal = QPalette()
    pal.setColor(QPalette.Window,          QColor("#0f0b0c"))
    pal.setColor(QPalette.WindowText,      QColor("#e5e3e4"))
    pal.setColor(QPalette.Base,            QColor("#2a2024"))
    pal.setColor(QPalette.AlternateBase,   QColor("#21161a"))
    pal.setColor(QPalette.Text,            QColor("#c5c0c2"))
    pal.setColor(QPalette.Button,          QColor("#21161a"))
    pal.setColor(QPalette.ButtonText,      QColor("#e5e3e4"))
    pal.setColor(QPalette.Highlight,       QColor("#dc2625"))
    pal.setColor(QPalette.HighlightedText, QColor("#ffffff"))
    app.setPalette(pal)

    win = PassionApp()
    win.show()
    sys.exit(app.exec_())


if __name__ == "__main__":
    main()
