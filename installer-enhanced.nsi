; Shelf Serpent Desktop - Enhanced Installer
; Professional Library Management System
; Created with NSIS Modern UI

!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "WinVer.nsh"
!include "x64.nsh"

; Application Information
!define APPNAME "Shelf Serpent Desktop"
!define COMPANYNAME "Testing Club City"
!define DESCRIPTION "Professional Library Management System"
!define VERSIONMAJOR 1
!define VERSIONMINOR 0
!define VERSIONBUILD 0
!define VERSION "${VERSIONMAJOR}.${VERSIONMINOR}.${VERSIONBUILD}"
!define HELPURL "https://github.com/Testing-Club-City/shelf-serpent-desktop"
!define UPDATEURL "https://github.com/Testing-Club-City/shelf-serpent-desktop/releases"
!define ABOUTURL "https://github.com/Testing-Club-City/shelf-serpent-desktop"
!define INSTALLSIZE 47104

; Installer Configuration
Name "${APPNAME} ${VERSION}"
OutFile "Shelf-Serpent-Desktop-Setup-v${VERSION}.exe"
Unicode True
RequestExecutionLevel admin
InstallDir "$PROGRAMFILES64\${APPNAME}"
InstallDirRegKey HKLM "Software\${COMPANYNAME}\${APPNAME}" "InstallLocation"

; Modern UI Configuration
!define MUI_ABORTWARNING
!define MUI_ICON "src-tauri\icons\icon.ico"
!define MUI_UNICON "src-tauri\icons\icon.ico"

; Welcome page
!define MUI_WELCOMEPAGE_TITLE "Welcome to ${APPNAME} Setup"
!define MUI_WELCOMEPAGE_TEXT "This wizard will guide you through the installation of ${APPNAME}.$\r$\n$\r$\n${DESCRIPTION}$\r$\n$\r$\nClick Next to continue."

; License page
!define MUI_LICENSEPAGE_TEXT_TOP "Please review the license terms before installing ${APPNAME}."
!define MUI_LICENSEPAGE_TEXT_BOTTOM "If you accept the terms of the agreement, click I Agree to continue. You must accept the agreement to install ${APPNAME}."

; Directory page
!define MUI_DIRECTORYPAGE_TEXT_TOP "Setup will install ${APPNAME} in the following folder. To install in a different folder, click Browse and select another folder. Click Next to continue."

; Installation page
!define MUI_INSTFILESPAGE_FINISHHEADER_TEXT "Installation Complete"
!define MUI_INSTFILESPAGE_FINISHHEADER_SUBTEXT "Setup was completed successfully."

; Finish page
!define MUI_FINISHPAGE_TITLE "Completing the ${APPNAME} Setup Wizard"
!define MUI_FINISHPAGE_TEXT "${APPNAME} has been installed on your computer.$\r$\n$\r$\nClick Finish to close this wizard."
!define MUI_FINISHPAGE_RUN "$INSTDIR\tauri-app.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Launch ${APPNAME}"
!define MUI_FINISHPAGE_LINK "Visit our website for updates and support"
!define MUI_FINISHPAGE_LINK_LOCATION "${ABOUTURL}"

; Pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "LICENSE"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

; Uninstaller pages
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; Languages
!insertmacro MUI_LANGUAGE "English"

; Version Information
VIProductVersion "${VERSIONMAJOR}.${VERSIONMINOR}.${VERSIONBUILD}.0"
VIAddVersionKey /LANG=${LANG_ENGLISH} "ProductName" "${APPNAME}"
VIAddVersionKey /LANG=${LANG_ENGLISH} "Comments" "${DESCRIPTION}"
VIAddVersionKey /LANG=${LANG_ENGLISH} "CompanyName" "${COMPANYNAME}"
VIAddVersionKey /LANG=${LANG_ENGLISH} "LegalCopyright" "© 2025 ${COMPANYNAME}"
VIAddVersionKey /LANG=${LANG_ENGLISH} "FileDescription" "${APPNAME} Installer"
VIAddVersionKey /LANG=${LANG_ENGLISH} "FileVersion" "${VERSION}"
VIAddVersionKey /LANG=${LANG_ENGLISH} "ProductVersion" "${VERSION}"

; Installer functions
Function .onInit
    ; Check if running on 64-bit Windows
    ${IfNot} ${RunningX64}
        MessageBox MB_OK|MB_ICONSTOP "This application requires 64-bit Windows."
        Abort
    ${EndIf}
    
    ; Check Windows version (Windows 10 or later recommended)
    ${IfNot} ${AtLeastWin10}
        MessageBox MB_YESNO|MB_ICONQUESTION "This application is designed for Windows 10 or later. Continue anyway?" IDYES continue
        Abort
        continue:
    ${EndIf}
    
    ; Check if already installed
    ReadRegStr $R0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "UninstallString"
    StrCmp $R0 "" done
    
    MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "${APPNAME} is already installed. $\n$\nClick OK to remove the previous version or Cancel to cancel this upgrade." IDOK uninst
    Abort
    
    uninst:
        ClearErrors
        ExecWait '$R0 _?=$INSTDIR'
        
        IfErrors no_remove_uninstaller done
        no_remove_uninstaller:
    
    done:
FunctionEnd

; Installation section
Section "Main Application" SecMain
    SectionIn RO ; Read-only section
    
    SetOutPath "$INSTDIR"
    
    ; Main executable
    File "src-tauri\target\x86_64-pc-windows-gnu\release\tauri-app.exe"
    File "LICENSE"
    
    ; Create uninstaller
    WriteUninstaller "$INSTDIR\Uninstall.exe"
    
    ; Create shortcuts
    CreateDirectory "$SMPROGRAMS\${APPNAME}"
    CreateShortcut "$SMPROGRAMS\${APPNAME}\${APPNAME}.lnk" "$INSTDIR\tauri-app.exe" "" "$INSTDIR\tauri-app.exe" 0
    CreateShortcut "$SMPROGRAMS\${APPNAME}\Uninstall ${APPNAME}.lnk" "$INSTDIR\Uninstall.exe" "" "$INSTDIR\Uninstall.exe" 0
    CreateShortcut "$DESKTOP\${APPNAME}.lnk" "$INSTDIR\tauri-app.exe" "" "$INSTDIR\tauri-app.exe" 0
    
    ; Registry entries
    WriteRegStr HKLM "Software\${COMPANYNAME}\${APPNAME}" "InstallLocation" "$INSTDIR"
    WriteRegStr HKLM "Software\${COMPANYNAME}\${APPNAME}" "Version" "${VERSION}"
    
    ; Add/Remove Programs entries
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "DisplayName" "${APPNAME}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "DisplayVersion" "${VERSION}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "Publisher" "${COMPANYNAME}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "UninstallString" "$INSTDIR\Uninstall.exe"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "QuietUninstallString" "$INSTDIR\Uninstall.exe /S"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "InstallLocation" "$INSTDIR"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "DisplayIcon" "$INSTDIR\tauri-app.exe,0"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "HelpLink" "${HELPURL}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "URLUpdateInfo" "${UPDATEURL}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "URLInfoAbout" "${ABOUTURL}"
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "NoModify" 1
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "NoRepair" 1
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "EstimatedSize" ${INSTALLSIZE}
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "VersionMajor" ${VERSIONMAJOR}
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "VersionMinor" ${VERSIONMINOR}
SectionEnd

; Uninstaller functions
Function un.onInit
    MessageBox MB_ICONQUESTION|MB_YESNO|MB_DEFBUTTON2 "Are you sure you want to completely remove ${APPNAME} and all of its components?" IDYES +2
    Abort
FunctionEnd

; Uninstallation section
Section "Uninstall"
    ; Remove files
    Delete "$INSTDIR\tauri-app.exe"
    Delete "$INSTDIR\LICENSE"
    Delete "$INSTDIR\Uninstall.exe"
    
    ; Remove shortcuts
    Delete "$SMPROGRAMS\${APPNAME}\${APPNAME}.lnk"
    Delete "$SMPROGRAMS\${APPNAME}\Uninstall ${APPNAME}.lnk"
    Delete "$DESKTOP\${APPNAME}.lnk"
    RMDir "$SMPROGRAMS\${APPNAME}"
    
    ; Remove registry entries
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}"
    DeleteRegKey HKLM "Software\${COMPANYNAME}\${APPNAME}"
    
    ; Remove installation directory if empty
    RMDir "$INSTDIR"
    
    ; Remove company registry key if empty
    DeleteRegKey /ifempty HKLM "Software\${COMPANYNAME}"
SectionEnd
