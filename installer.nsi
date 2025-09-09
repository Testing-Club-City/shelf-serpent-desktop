; Shelf Serpent Desktop - Library Management System Installer
; Created with NSIS (Nullsoft Scriptable Install System)

!define APPNAME "Shelf Serpent Desktop"
!define COMPANYNAME "Testing Club City"
!define DESCRIPTION "Professional Library Management System"
!define VERSIONMAJOR 1
!define VERSIONMINOR 0
!define VERSIONBUILD 0
!define HELPURL "https://github.com/Testing-Club-City/shelf-serpent-desktop"
!define UPDATEURL "https://github.com/Testing-Club-City/shelf-serpent-desktop/releases"
!define ABOUTURL "https://github.com/Testing-Club-City/shelf-serpent-desktop"
!define INSTALLSIZE 47104  ; Size in KB (45MB)

RequestExecutionLevel admin ; Require admin rights on NT6+ (When UAC is turned on)

InstallDir "$PROGRAMFILES64\${APPNAME}"

; rtf or txt file - remember if it is txt, it must be in the DOS text format (\r\n)
LicenseData "LICENSE"
; This will be in the installer/uninstaller's title bar
Name "${APPNAME}"
Icon "src-tauri\icons\icon.ico"
outFile "Shelf-Serpent-Desktop-Setup.exe"

!include LogicLib.nsh

; Just three pages - license agreement, install location, and installation
page license
page directory
Page instfiles

!macro VerifyUserIsAdmin
UserInfo::GetAccountType
pop $0
${If} $0 != "admin" ; Require admin rights on NT4+
    messageBox mb_iconstop "Administrator rights required!"
    setErrorLevel 740 ; ERROR_ELEVATION_REQUIRED
    quit
${EndIf}
!macroend

function .onInit
    setShellVarContext all
    !insertmacro VerifyUserIsAdmin
functionEnd

section "install"
    ; Files for the install directory - to build the installer, these should be in the same directory as the install script (this file)
    setOutPath $INSTDIR
    ; Files added here should be removed by the uninstaller (see section "uninstall")
    file "src-tauri\target\x86_64-pc-windows-gnu\release\tauri-app.exe"
    file "LICENSE"
    
    ; Add any other files needed
    ; file /r "resources\*.*"
    
    ; Uninstaller - See function un.onInit and section "uninstall" for configuration
    writeUninstaller "$INSTDIR\uninstall.exe"

    ; Start Menu
    createDirectory "$SMPROGRAMS\${APPNAME}"
    createShortCut "$SMPROGRAMS\${APPNAME}\${APPNAME}.lnk" "$INSTDIR\tauri-app.exe" "" "$INSTDIR\tauri-app.exe"
    createShortCut "$SMPROGRAMS\${APPNAME}\Uninstall.lnk" "$INSTDIR\uninstall.exe" "" "$INSTDIR\uninstall.exe"

    ; Desktop shortcut
    createShortCut "$DESKTOP\${APPNAME}.lnk" "$INSTDIR\tauri-app.exe" "" "$INSTDIR\tauri-app.exe"

    ; Registry information for add/remove programs
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "DisplayName" "${APPNAME} - ${DESCRIPTION}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "UninstallString" "$\"$INSTDIR\uninstall.exe$\""
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "QuietUninstallString" "$\"$INSTDIR\uninstall.exe$\" /S"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "InstallLocation" "$\"$INSTDIR$\""
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "DisplayIcon" "$\"$INSTDIR\tauri-app.exe$\""
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "Publisher" "${COMPANYNAME}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "HelpLink" "${HELPURL}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "URLUpdateInfo" "${UPDATEURL}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "URLInfoAbout" "${ABOUTURL}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "DisplayVersion" "${VERSIONMAJOR}.${VERSIONMINOR}.${VERSIONBUILD}"
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "VersionMajor" ${VERSIONMAJOR}
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "VersionMinor" ${VERSIONMINOR}
    ; There is no option for modifying or repairing the install
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "NoModify" 1
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "NoRepair" 1
    ; Set the INSTALLSIZE constant (!defined at the top of this script) so Add/Remove Programs can accurately report the size
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "EstimatedSize" ${INSTALLSIZE}
sectionEnd

; Modern installer finish page
!define MUI_FINISHPAGE_RUN "$INSTDIR\tauri-app.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Launch ${APPNAME}"

; Uninstaller
function un.onInit
    SetShellVarContext all

    ; Verify the uninstaller - last chance to back out
    MessageBox MB_OKCANCEL "Permanently remove ${APPNAME}?" IDOK next
        Abort
    next:
    !insertmacro VerifyUserIsAdmin
functionEnd

section "uninstall"
    ; Remove Start Menu launcher
    delete "$SMPROGRAMS\${APPNAME}\${APPNAME}.lnk"
    delete "$SMPROGRAMS\${APPNAME}\Uninstall.lnk"
    ; Try to remove the Start Menu folder - this will only happen if it is empty
    rmDir "$SMPROGRAMS\${APPNAME}"

    ; Remove Desktop shortcut
    delete "$DESKTOP\${APPNAME}.lnk"

    ; Remove files
    delete "$INSTDIR\tauri-app.exe"
    delete "$INSTDIR\LICENSE"

    ; Always delete uninstaller as the last action
    delete "$INSTDIR\uninstall.exe"

    ; Try to remove the install directory - this will only happen if it is empty
    rmDir "$INSTDIR"

    ; Remove uninstaller information from the registry
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}"
sectionEnd
