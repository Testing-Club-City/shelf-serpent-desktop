# 📦 Shelf Serpent Desktop - Windows Installer

## 🎉 Installation Files Created

Your Shelf Serpent Desktop application has been successfully packaged for Windows distribution!

### 📁 Files Available:

1. **`Shelf-Serpent-Desktop-Setup.exe`** (Basic Installer)
   - Simple NSIS installer
   - Size: ~16MB
   - Basic installation with shortcuts

2. **`Shelf-Serpent-Desktop-Setup-v1.0.0.exe`** (Enhanced Installer)
   - Modern UI installer with professional appearance
   - Size: ~16MB
   - Advanced features and better user experience

3. **`tauri-app.exe`** (Standalone Executable)
   - Located in: `src-tauri/target/x86_64-pc-windows-gnu/release/`
   - Size: ~45MB
   - Can be run directly without installation

## 🚀 Installation Instructions

### For End Users:

1. **Download** the installer file to a Windows computer
2. **Right-click** the installer and select "Run as Administrator"
3. **Follow** the installation wizard:
   - Accept the license agreement
   - Choose installation directory (default: `C:\Program Files\Shelf Serpent Desktop`)
   - Complete the installation
4. **Launch** the application from:
   - Desktop shortcut
   - Start Menu → Shelf Serpent Desktop
   - Or run directly from installation folder

### System Requirements:

- **OS**: Windows 10 or later (64-bit)
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 100MB free space
- **Network**: Optional (for online sync features)

## ✨ Features Included

### 📚 Core Functionality:
- ✅ **Offline-First Operation**: Works without internet connection
- ✅ **Local SQLite Database**: All data stored locally
- ✅ **Book Management**: Add, edit, search, and organize books
- ✅ **Student Management**: Register and manage library users
- ✅ **Borrowing System**: Track book loans and returns
- ✅ **Fine Management**: Automatic fine calculations
- ✅ **Barcode Support**: Integration ready for barcode scanners

### 🔄 Advanced Features:
- ✅ **Online Sync**: Synchronizes with Supabase when online
- ✅ **Automatic Fallback**: Seamlessly switches between online/offline
- ✅ **Real-time Updates**: Live data synchronization
- ✅ **Comprehensive Reports**: Generate detailed library reports
- ✅ **Group Borrowings**: Support for class/group book loans
- ✅ **Theft Reporting**: Track lost or stolen books

## 🛠️ For Developers

### Building the Installer:

```bash
# Build Windows executable and installer
./build-installer.sh

# Or manually:
npm run tauri build -- --target x86_64-pc-windows-gnu
makensis installer-enhanced.nsi
```

### Customizing the Installer:

1. **Edit** `installer-enhanced.nsi` for advanced customization
2. **Modify** company name, version, and URLs
3. **Add** additional files or registry entries
4. **Rebuild** using `makensis installer-enhanced.nsi`

## 📋 Installation Details

### What Gets Installed:
- Main application executable (`tauri-app.exe`)
- License file
- Desktop shortcut
- Start Menu shortcuts
- Uninstaller
- Registry entries for Add/Remove Programs

### Installation Locations:
- **Program Files**: `C:\Program Files\Shelf Serpent Desktop\`
- **Desktop**: `Shelf Serpent Desktop.lnk`
- **Start Menu**: `Start Menu\Programs\Shelf Serpent Desktop\`

### Registry Entries:
- Application settings: `HKLM\Software\Testing Club City\Shelf Serpent Desktop`
- Uninstall info: `HKLM\Software\Microsoft\Windows\CurrentVersion\Uninstall\Shelf Serpent Desktop`

## 🔧 Troubleshooting

### Common Issues:

1. **"Administrator rights required"**
   - Right-click installer → "Run as Administrator"

2. **"This application requires 64-bit Windows"**
   - Ensure you're running 64-bit Windows 10 or later

3. **Installation fails**
   - Check available disk space (100MB required)
   - Temporarily disable antivirus during installation

4. **Application won't start**
   - Check Windows Event Viewer for error details
   - Ensure all Visual C++ redistributables are installed

### Support:
- **GitHub**: https://github.com/Testing-Club-City/shelf-serpent-desktop
- **Issues**: https://github.com/Testing-Club-City/shelf-serpent-desktop/issues

## 📄 License

This software is licensed under the MIT License. See the `LICENSE` file for details.

---

**Built with ❤️ by Testing Club City**

*Professional Library Management Made Simple*
