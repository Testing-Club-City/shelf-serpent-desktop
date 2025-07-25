# 📚 Shelf Serpent Desktop - Library Management System

A modern, offline-capable desktop application for library management built with Tauri, React, and TypeScript. Features real-time synchronization with Supabase and comprehensive offline functionality.

## ✨ Features

### 📖 Core Library Management
- **Book Management**: Add, edit, delete, and search books with advanced filtering
- **Student Management**: Comprehensive student registration and profile management
- **Borrowing System**: Track book borrowings, returns, and due dates
- **Category Organization**: Organize books by categories with custom shelf locations
- **Staff Management**: Role-based access control for library staff

### 🔄 Hybrid Online/Offline System
- **Offline-First**: Full functionality without internet connection
- **Real-time Sync**: Seamless synchronization with Supabase when online
- **Conflict Resolution**: Intelligent handling of data conflicts
- **Background Sync**: Automatic data synchronization in the background

### 📊 Advanced Features
- **Fine Management**: Automated fine calculations for overdue books
- **Reports & Analytics**: Comprehensive reports on library usage
- **Barcode Support**: Integration with barcode scanners for quick operations
- **Theft Reporting**: Track and manage lost or stolen books
- **Group Borrowings**: Support for class or group book borrowings

### 🎨 Modern UI/UX
- **Tailwind CSS**: Modern, responsive design
- **Dark Mode**: Support for light and dark themes
- **Accessibility**: ARIA-compliant components
- **Fast Performance**: Optimized for large datasets

## 🛠️ Technology Stack

### Frontend
- **Tauri**: Cross-platform desktop framework
- **React 18**: Modern React with hooks and functional components
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first CSS framework
- **React Hook Form**: Efficient form handling
- **TanStack Query**: Data fetching and caching
- **Radix UI**: Accessible component primitives

### Backend
- **Rust**: High-performance backend with Tauri
- **SQLite**: Local database for offline functionality
- **Supabase**: Cloud database and authentication
- **rusqlite**: SQLite bindings for Rust
- **tokio**: Async runtime for Rust

### Development Tools
- **Vite**: Fast build tool and development server
- **ESLint**: Code linting and quality checks
- **Prettier**: Code formatting
- **TypeScript**: Static type checking

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v18 or higher)
- **Rust** (latest stable version)
- **Git**

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Testing-Club-City/shelf-serpent-desktop.git
   cd shelf-serpent-desktop
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your Supabase credentials
   ```

4. **Run in development mode**
   ```bash
   npm run tauri dev
   ```

### Building for Production

1. **Build the application**
   ```bash
   npm run tauri build
   ```

2. **Find installers in**
   - Windows: `src-tauri/target/release/bundle/msi/` or `src-tauri/target/release/bundle/nsis/`
   - macOS: `src-tauri/target/release/bundle/dmg/`
   - Linux: `src-tauri/target/release/bundle/deb/` or `src-tauri/target/release/bundle/rpm/`

## 📁 Project Structure

```
shelf-serpent-desktop/
├── src/                          # React frontend source
│   ├── components/              # React components
│   │   ├── admin/              # Admin panel components
│   │   ├── borrowing/          # Borrowing management
│   │   ├── books/              # Book management
│   │   ├── students/           # Student management
│   │   └── ui/                 # Reusable UI components
│   ├── hooks/                  # Custom React hooks
│   ├── integrations/           # API integrations
│   └── pages/                  # Page components
├── src-tauri/                  # Tauri backend
│   ├── src/                    # Rust source code
│   │   ├── database.rs         # Database management
│   │   ├── sync.rs             # Synchronization logic
│   │   └── main.rs             # Main application entry
│   └── Cargo.toml              # Rust dependencies
├── public/                     # Static assets
└── package.json                # Node.js dependencies
```

## 🔧 Configuration

### Environment Variables
Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Database Setup
The application automatically creates and manages the local SQLite database. For Supabase setup, refer to the [Database Schema](#database-schema) section.

## 📊 Database Schema

The application uses a hybrid approach with both local SQLite and remote Supabase PostgreSQL databases. Key tables include:

- **books**: Book catalog with metadata
- **students**: Student information and enrollment
- **borrowings**: Active and historical borrowing records
- **categories**: Book categorization system
- **staff**: Library staff and permissions
- **fines**: Fine calculations and payments
- **system_logs**: Audit trail and system events

## 🔄 Synchronization

The app implements intelligent bi-directional synchronization:

1. **Local-First**: All operations work offline
2. **Background Sync**: Automatic sync when connection is available
3. **Conflict Resolution**: Smart merging of conflicting changes
4. **Incremental Updates**: Only sync changed data for efficiency

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -m 'Add some feature'`
4. Push to branch: `git push origin feature-name`
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🏫 About

Developed for modern libraries and educational institutions requiring robust, offline-capable library management solutions. Perfect for schools, colleges, and public libraries of all sizes.

## 📞 Support

For support, bug reports, or feature requests, please:
- Open an issue on GitHub
- Contact the development team
- Check the documentation wiki

---

**Built with ❤️ by Testing Club City**

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
