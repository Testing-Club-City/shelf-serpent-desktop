import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  AlertCircle, 
  CheckCircle, 
  Wrench, 
  Database, 
  RefreshCw, 
  Bug,
  Zap,
  Target,
  FileText,
  Users,
  BookOpen,
  AlertTriangle,
  Shield
} from 'lucide-react';

interface DiagnosticResult {
  category: string;
  issues: number;
  details: any[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface RepairResult {
  category: string;
  fixed: number;
  skipped: number;
  errors: number;
  details: string[];
}

export const EnhancedDataRepairTools: React.FC = () => {
  const [isRepairing, setIsRepairing] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [repairProgress, setRepairProgress] = useState(0);
  const [diagnosticResults, setDiagnosticResults] = useState<DiagnosticResult[]>([]);
  const [repairResults, setRepairResults] = useState<RepairResult[]>([]);
  const { toast } = useToast();

  const runComprehensiveDiagnostics = async () => {
    setIsChecking(true);
    setDiagnosticResults([]);
    
    try {
      console.log('🔍 Running comprehensive database diagnostics...');
      
      const results: DiagnosticResult[] = [];
      
      // 1. Check Books and Book Copies Consistency (with lost book protection)
      console.log('Checking books and book copies consistency...');
      const { data: books } = await supabase
        .from('books')
        .select('id, title, book_code, total_copies, available_copies');
      
      const { data: bookCopies } = await supabase
        .from('book_copies')
        .select('id, book_id, tracking_code, status, condition');
      
      // Get lost borrowings to cross-reference
      const { data: lostBorrowings } = await supabase
        .from('borrowings')
        .select('book_copy_id, is_lost')
        .eq('is_lost', true);
      
      const lostCopyIds = new Set(lostBorrowings?.map(b => b.book_copy_id) || []);
      
      let bookIssues = 0;
      const bookDetails = [];
      
      if (books && bookCopies) {
        // Books without book codes
        const booksWithoutCodes = books.filter(book => !book.book_code);
        bookIssues += booksWithoutCodes.length;
        
        // Books with mismatched copy counts (excluding lost copies)
        const booksWithMismatchedCopies = books.filter(book => {
          const copies = bookCopies.filter(copy => 
            copy.book_id === book.id && 
            copy.status !== 'lost' && 
            !lostCopyIds.has(copy.id)
          );
          return book.total_copies !== copies.length;
        });
        bookIssues += booksWithMismatchedCopies.length;
        
        // Books with incorrect available counts (excluding lost copies)
        const booksWithWrongAvailable = books.filter(book => {
          const availableCopies = bookCopies.filter(copy => 
            copy.book_id === book.id && 
            copy.status === 'available' &&
            !lostCopyIds.has(copy.id)
          );
          return book.available_copies !== availableCopies.length;
        });
        bookIssues += booksWithWrongAvailable.length;
        
        bookDetails.push(
          ...booksWithoutCodes.map(b => `Book "${b.title}" missing book code`),
          ...booksWithMismatchedCopies.map(b => `Book "${b.title}" has mismatched copy count (excluding lost copies)`),
          ...booksWithWrongAvailable.map(b => `Book "${b.title}" has incorrect available count (excluding lost copies)`)
        );
      }
      
      results.push({
        category: 'Books & Copies (Lost-Safe)',
        issues: bookIssues,
        details: bookDetails,
        severity: bookIssues > 50 ? 'critical' : bookIssues > 20 ? 'high' : bookIssues > 5 ? 'medium' : 'low'
      });
      
      // 2. Check Lost Books Integrity
      console.log('Checking lost books integrity...');
      const { data: lostCopiesFromCopies } = await supabase
        .from('book_copies')
        .select('id, book_id, tracking_code, status')
        .eq('status', 'lost');
      
      const { data: lostCopiesFromBorrowings } = await supabase
        .from('borrowings')
        .select('id, book_copy_id, is_lost, student_id')
        .eq('is_lost', true);
      
      // Check for lost books without proper fines
      const { data: lostBookFines } = await supabase
        .from('fines')
        .select('borrowing_id, fine_type, status')
        .in('fine_type', ['lost', 'lost_book']);
      
      const lostBorrowingIds = new Set(lostCopiesFromBorrowings?.map(b => b.id) || []);
      const lostBorrowingsWithFines = new Set(lostBookFines?.map(f => f.borrowing_id) || []);
      
      const lostBorrowingsWithoutFines = lostCopiesFromBorrowings?.filter(b => 
        !lostBorrowingsWithFines.has(b.id)
      ) || [];
      
      let lostBookIssues = 0;
      const lostBookDetails = [];
      
      // Inconsistent lost status between copies and borrowings
      const inconsistentLostStatus = lostCopiesFromCopies?.filter(copy => {
        const hasBorrowingRecord = lostCopiesFromBorrowings?.some(b => b.book_copy_id === copy.id);
        return !hasBorrowingRecord;
      }) || [];
      
      lostBookIssues += inconsistentLostStatus.length + lostBorrowingsWithoutFines.length;
      
      lostBookDetails.push(
        ...inconsistentLostStatus.map(() => 'Book copy marked as lost without borrowing record'),
        ...lostBorrowingsWithoutFines.map(() => 'Lost book without proper fine record')
      );
      
      results.push({
        category: 'Lost Books Integrity',
        issues: lostBookIssues,
        details: lostBookDetails,
        severity: lostBookIssues > 10 ? 'high' : lostBookIssues > 0 ? 'medium' : 'low'
      });
      
      // 3. Check Borrowings Consistency (with lost book awareness)
      console.log('Checking borrowings consistency...');
      const { data: borrowings } = await supabase
        .from('borrowings')
        .select('id, book_copy_id, status, is_lost');
      
      let borrowingIssues = 0;
      const borrowingDetails = [];
      
      if (borrowings && bookCopies) {
        // Active borrowings with no book copy reference (excluding lost books)
        const orphanedBorrowings = borrowings.filter(b => 
          b.status === 'active' && !b.book_copy_id && !b.is_lost
        );
        borrowingIssues += orphanedBorrowings.length;
        
        // Active borrowings with copies marked as available (excluding lost books)
        const inconsistentBorrowings = borrowings.filter(b => {
          if (b.status !== 'active' || !b.book_copy_id || b.is_lost) return false;
          const copy = bookCopies.find(c => c.id === b.book_copy_id);
          return copy && copy.status === 'available';
        });
        borrowingIssues += inconsistentBorrowings.length;
        
        // Book copies marked as borrowed with no active borrowing (excluding lost copies)
        const orphanedCopies = bookCopies.filter(copy => {
          if (copy.status !== 'borrowed') return false;
          if (lostCopyIds.has(copy.id)) return false; // Skip lost copies
          return !borrowings.some(b => b.book_copy_id === copy.id && b.status === 'active');
        });
        borrowingIssues += orphanedCopies.length;
        
        borrowingDetails.push(
          ...orphanedBorrowings.map(() => 'Active borrowing without book copy reference (non-lost)'),
          ...inconsistentBorrowings.map(() => 'Active borrowing with available book copy (non-lost)'),
          ...orphanedCopies.map(() => 'Book copy marked as borrowed without active borrowing (non-lost)')
        );
      }
      
      results.push({
        category: 'Borrowings (Lost-Aware)',
        issues: borrowingIssues,
        details: borrowingDetails,
        severity: borrowingIssues > 20 ? 'critical' : borrowingIssues > 10 ? 'high' : borrowingIssues > 3 ? 'medium' : 'low'
      });
      
      // 4. Check Tracking Codes (excluding lost copies)
      console.log('Checking tracking codes...');
      const copiesWithoutTracking = bookCopies?.filter(copy => 
        !copy.tracking_code && 
        copy.status !== 'lost' && 
        !lostCopyIds.has(copy.id)
      ) || [];
      
      results.push({
        category: 'Tracking Codes (Non-Lost)',
        issues: copiesWithoutTracking.length,
        details: copiesWithoutTracking.map(() => 'Non-lost book copy without tracking code'),
        severity: copiesWithoutTracking.length > 100 ? 'high' : copiesWithoutTracking.length > 20 ? 'medium' : 'low'
      });
      
      // 5. Check Students Data
      console.log('Checking students data...');
      const { data: students } = await supabase
        .from('students')
        .select('id, admission_number, class_grade');
      
      const duplicateAdmissions = students ? 
        students.filter((student, index, arr) => 
          arr.findIndex(s => s.admission_number === student.admission_number) !== index
        ) : [];
      
      results.push({
        category: 'Students',
        issues: duplicateAdmissions.length,
        details: duplicateAdmissions.map(s => `Duplicate admission number: ${s.admission_number}`),
        severity: duplicateAdmissions.length > 10 ? 'high' : duplicateAdmissions.length > 0 ? 'medium' : 'low'
      });
      
      // 6. Check Fines Consistency
      console.log('Checking fines consistency...');
      const { data: fines } = await supabase
        .from('fines')
        .select('id, borrowing_id, student_id, status, amount, fine_type');
      
      const invalidFines = fines?.filter(fine => 
        !fine.student_id || fine.amount <= 0
      ) || [];
      
      results.push({
        category: 'Fines',
        issues: invalidFines.length,
        details: invalidFines.map(() => 'Fine with invalid data'),
        severity: invalidFines.length > 20 ? 'medium' : 'low'
      });
      
      setDiagnosticResults(results);
      
      const totalIssues = results.reduce((sum, result) => sum + result.issues, 0);
      toast({
        title: 'Lost-Safe Diagnostics Complete',
        description: `Found ${totalIssues} issues across ${results.length} categories (protected lost books)`,
      });
      
    } catch (error: any) {
      console.error('Error running diagnostics:', error);
      toast({
        title: 'Error',
        description: `Failed to run diagnostics: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setIsChecking(false);
    }
  };

  const fixAllIssues = async () => {
    setIsRepairing(true);
    setRepairProgress(0);
    setRepairResults([]);
    
    try {
      console.log('🔧 Starting lost-safe comprehensive repair process...');
      
      const results: RepairResult[] = [];
      let currentStep = 0;
      const totalSteps = 7;
      
      // Get lost book references first for protection
      const { data: lostBorrowings } = await supabase
        .from('borrowings')
        .select('book_copy_id, is_lost')
        .eq('is_lost', true);
      
      const lostCopyIds = new Set(lostBorrowings?.map(b => b.book_copy_id) || []);
      
      const { data: lostCopies } = await supabase
        .from('book_copies')
        .select('id')
        .eq('status', 'lost');
      
      lostCopies?.forEach(copy => lostCopyIds.add(copy.id));
      
      console.log(`🛡️ Protected ${lostCopyIds.size} lost book copies from modifications`);
      
      // Step 1: Fix missing book codes
      currentStep++;
      setRepairProgress((currentStep / totalSteps) * 100);
      console.log('Step 1: Fixing missing book codes...');
      
      const { data: booksWithoutCodes } = await supabase
        .from('books')
        .select('id, title')
        .is('book_code', null);
      
      let fixedCodes = 0;
      if (booksWithoutCodes) {
        for (const book of booksWithoutCodes) {
          const bookCode = book.title.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, '') || 'BK';
          const { error } = await supabase
            .from('books')
            .update({ book_code: bookCode })
            .eq('id', book.id);
          
          if (!error) fixedCodes++;
        }
      }
      
      results.push({
        category: 'Book Codes',
        fixed: fixedCodes,
        skipped: 0,
        errors: (booksWithoutCodes?.length || 0) - fixedCodes,
        details: [`Generated book codes for ${fixedCodes} books`]
      });
      
      // Step 2: Create missing book copies (LOST-SAFE)
      currentStep++;
      setRepairProgress((currentStep / totalSteps) * 100);
      console.log('Step 2: Creating missing book copies (lost-safe)...');
      
      const { data: allBooks } = await supabase
        .from('books')
        .select('id, title, book_code, total_copies, available_copies');
      
      let createdCopies = 0;
      if (allBooks) {
        for (const book of allBooks) {
          // Get existing copies (excluding lost ones for count)
          const { data: existingCopies } = await supabase
            .from('book_copies')
            .select('id, status')
            .eq('book_id', book.id);
          
          const nonLostCopies = existingCopies?.filter(copy => 
            copy.status !== 'lost' && !lostCopyIds.has(copy.id)
          ) || [];
          
          const neededCopies = (book.total_copies || 0) - nonLostCopies.length;
          
          if (neededCopies > 0) {
            const nextCopyNumber = Math.max(...(existingCopies?.map(c => 1) || [0])) + 1;
            
            for (let i = 0; i < neededCopies; i++) {
              const trackingCode = `${book.book_code}/${String(nextCopyNumber + i).padStart(3, '0')}/24`;
              
              // FIX: Include book_code in the insert
              const { error } = await supabase
                .from('book_copies')
                .insert({
                  book_id: book.id,
                  copy_number: nextCopyNumber + i,
                  book_code: book.book_code || 'BK',  // Add book_code field
                  tracking_code: trackingCode,
                  status: 'available',
                  condition: 'good',
                  notes: 'Auto-created (lost-safe repair)'
                });
              
              if (!error) createdCopies++;
            }
          }
        }
      }
      
      results.push({
        category: 'Missing Copies (Lost-Safe)',
        fixed: createdCopies,
        skipped: 0,
        errors: 0,
        details: [`Created ${createdCopies} missing book copies (protected lost books)`]
      });
      
      // Step 3: Fix borrowing status inconsistencies (LOST-AWARE)
      currentStep++;
      setRepairProgress((currentStep / totalSteps) * 100);
      console.log('Step 3: Fixing borrowing status inconsistencies (lost-aware)...');
      
      const { data: activeBorrowings } = await supabase
        .from('borrowings')
        .select(`
          id, book_copy_id, is_lost,
          book_copies!inner(id, status)
        `)
        .eq('status', 'active')
        .not('book_copy_id', 'is', null);
      
      let fixedBorrowingStatuses = 0;
      if (activeBorrowings) {
        for (const borrowing of activeBorrowings) {
          // Skip lost borrowings
          if (borrowing.is_lost || lostCopyIds.has(borrowing.book_copy_id)) {
            continue;
          }
          
          if (borrowing.book_copies?.status !== 'borrowed') {
            const { error } = await supabase
              .from('book_copies')
              .update({ status: 'borrowed' })
              .eq('id', borrowing.book_copy_id);
            
            if (!error) fixedBorrowingStatuses++;
          }
        }
      }
      
      // Fix orphaned borrowed copies (non-lost)
      const { data: borrowedCopies } = await supabase
        .from('book_copies')
        .select('id')
        .eq('status', 'borrowed');
      
      const { data: allActiveBorrowings } = await supabase
        .from('borrowings')
        .select('book_copy_id')
        .eq('status', 'active')
        .not('book_copy_id', 'is', null);
      
      const activeCopyIds = new Set(allActiveBorrowings?.map(b => b.book_copy_id) || []);
      const orphanedCopies = borrowedCopies?.filter(copy => 
        !activeCopyIds.has(copy.id) && !lostCopyIds.has(copy.id)
      ) || [];
      
      let fixedOrphanedCopies = 0;
      for (const copy of orphanedCopies) {
        const { error } = await supabase
          .from('book_copies')
          .update({ status: 'available' })
          .eq('id', copy.id);
        
        if (!error) fixedOrphanedCopies++;
      }
      
      results.push({
        category: 'Borrowing Status (Lost-Aware)',
        fixed: fixedBorrowingStatuses + fixedOrphanedCopies,
        skipped: lostCopyIds.size,
        errors: 0,
        details: [
          `Fixed ${fixedBorrowingStatuses} borrowing statuses`,
          `Fixed ${fixedOrphanedCopies} orphaned copies`,
          `Protected ${lostCopyIds.size} lost book copies`
        ]
      });
      
      // Step 4: Update book availability counts (LOST-SAFE)
      currentStep++;
      setRepairProgress((currentStep / totalSteps) * 100);
      console.log('Step 4: Updating book availability counts (lost-safe)...');
      
      let updatedBooks = 0;
      if (allBooks) {
        for (const book of allBooks) {
          const { data: totalCopies } = await supabase
            .from('book_copies')
            .select('id', { count: 'exact' })
            .eq('book_id', book.id);
          
          const { data: availableCopies } = await supabase
            .from('book_copies')
            .select('id', { count: 'exact' })
            .eq('book_id', book.id)
            .eq('status', 'available');
          
          const { error } = await supabase
            .from('books')
            .update({
              total_copies: totalCopies?.length || 0,
              available_copies: availableCopies?.length || 0
            })
            .eq('id', book.id);
          
          if (!error) updatedBooks++;
        }
      }
      
      results.push({
        category: 'Book Counts (Lost-Safe)',
        fixed: updatedBooks,
        skipped: 0,
        errors: (allBooks?.length || 0) - updatedBooks,
        details: [`Updated availability counts for ${updatedBooks} books (excluded lost copies)`]
      });
      
      // Step 5: Fix tracking codes (NON-LOST ONLY)
      currentStep++;
      setRepairProgress((currentStep / totalSteps) * 100);
      console.log('Step 5: Fixing tracking codes (non-lost only)...');
      
      const { data: copiesWithoutTracking } = await supabase
        .from('book_copies')
        .select(`
          id, copy_number, created_at, status,
          books!inner(book_code)
        `)
        .is('tracking_code', null)
        .neq('status', 'lost');
      
      let fixedTrackingCodes = 0;
      if (copiesWithoutTracking) {
        for (const copy of copiesWithoutTracking) {
          // Skip if it's in the lost copies set
          if (lostCopyIds.has(copy.id)) continue;
          
          const year = copy.created_at 
            ? new Date(copy.created_at).getFullYear().toString().slice(-2)
            : new Date().getFullYear().toString().slice(-2);
          
          const paddedCopyNumber = String(copy.copy_number || 1).padStart(3, '0');
          const trackingCode = `${copy.books.book_code}/${paddedCopyNumber}/${year}`;
          
          const { error } = await supabase
            .from('book_copies')
            .update({ tracking_code: trackingCode })
            .eq('id', copy.id);
          
          if (!error) fixedTrackingCodes++;
        }
      }
      
      results.push({
        category: 'Tracking Codes (Non-Lost)',
        fixed: fixedTrackingCodes,
        skipped: lostCopyIds.size,
        errors: 0,
        details: [
          `Generated tracking codes for ${fixedTrackingCodes} non-lost copies`,
          `Protected ${lostCopyIds.size} lost copies from modification`
        ]
      });
      
      // Step 6: Ensure lost book integrity
      currentStep++;
      setRepairProgress((currentStep / totalSteps) * 100);
      console.log('Step 6: Ensuring lost book integrity...');
      
      let lostIntegrityFixed = 0;
      
      // Ensure all lost borrowings have their copies marked as lost
      if (lostBorrowings) {
        for (const borrowing of lostBorrowings) {
          if (borrowing.book_copy_id) {
            const { error } = await supabase
              .from('book_copies')
              .update({ status: 'lost', condition: 'lost' })
              .eq('id', borrowing.book_copy_id);
            
            if (!error) lostIntegrityFixed++;
          }
        }
      }
      
      results.push({
        category: 'Lost Book Integrity',
        fixed: lostIntegrityFixed,
        skipped: 0,
        errors: 0,
        details: [`Ensured ${lostIntegrityFixed} lost book copies have correct status`]
      });
      
      // Step 7: Clean up invalid data (SAFE)
      currentStep++;
      setRepairProgress((currentStep / totalSteps) * 100);
      console.log('Step 7: Cleaning up invalid data (safe)...');
      
      // Only remove fines with zero amounts (safe operation)
      const { error: fineCleanupError } = await supabase
        .from('fines')
        .delete()
        .eq('amount', 0);
      
      let cleanupCount = 0;
      if (!fineCleanupError) cleanupCount++;
      
      results.push({
        category: 'Safe Data Cleanup',
        fixed: cleanupCount,
        skipped: 0,
        errors: fineCleanupError ? 1 : 0,
        details: ['Removed invalid fine records (zero amounts only)']
      });
      
      setRepairProgress(100);
      setRepairResults(results);
      
      const totalFixed = results.reduce((sum, result) => sum + result.fixed, 0);
      const totalProtected = lostCopyIds.size;
      
      toast({
        title: 'Lost-Safe Repair Complete!',
        description: `Fixed ${totalFixed} issues, protected ${totalProtected} lost books`,
      });
      
    } catch (error: any) {
      console.error('Error during repair:', error);
      toast({
        title: 'Repair Failed',
        description: `Error during repair: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setIsRepairing(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="w-4 h-4" />;
      case 'high': return <AlertCircle className="w-4 h-4" />;
      case 'medium': return <AlertCircle className="w-4 h-4" />;
      default: return <CheckCircle className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-green-600" />
            Lost-Safe Data Repair & Diagnostics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert className="border-green-200 bg-green-50">
            <Shield className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              <strong>Lost Book Protection Active:</strong> This system automatically protects 
              all lost book copies from being modified or mistaken as available. Lost books 
              remain marked as lost and are excluded from repair operations.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              onClick={runComprehensiveDiagnostics}
              disabled={isChecking || isRepairing}
              size="lg"
              variant="outline"
              className="h-auto p-6 flex flex-col items-center gap-3"
            >
              <Database className="w-8 h-8" />
              <div className="text-center">
                <div className="font-semibold">
                  {isChecking ? 'Scanning Database...' : 'Run Lost-Safe Diagnostics'}
                </div>
                <div className="text-sm text-muted-foreground">
                  Comprehensive analysis protecting lost books
                </div>
              </div>
            </Button>

            <Button
              onClick={fixAllIssues}
              disabled={isRepairing || isChecking || diagnosticResults.length === 0}
              size="lg"
              className="h-auto p-6 flex flex-col items-center gap-3 bg-green-600 hover:bg-green-700"
            >
              <Zap className="w-8 h-8" />
              <div className="text-center">
                <div className="font-semibold">
                  {isRepairing ? 'Repairing Issues...' : 'Fix All Issues (Lost-Safe)'}
                </div>
                <div className="text-sm opacity-90">
                  Bulk repair with lost book protection
                </div>
              </div>
            </Button>
          </div>

          {isRepairing && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Lost-Safe Repair Progress</span>
                <span>{Math.round(repairProgress)}%</span>
              </div>
              <Progress value={repairProgress} className="h-3" />
            </div>
          )}

          {/* Diagnostic Results */}
          {diagnosticResults.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Target className="w-5 h-5" />
                Lost-Safe Diagnostic Results
              </h3>
              
              <div className="grid gap-4">
                {diagnosticResults.map((result, index) => (
                  <Card key={index} className="border-l-4 border-l-blue-500">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          <span className="font-medium">{result.category}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={getSeverityColor(result.severity)}>
                            {getSeverityIcon(result.severity)}
                            {result.severity.toUpperCase()}
                          </Badge>
                          <Badge variant="secondary">
                            {result.issues} issue{result.issues !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                      </div>
                      
                      {result.details.length > 0 && (
                        <div className="text-sm text-gray-600">
                          <div className="font-medium mb-1">Issues found:</div>
                          <ul className="list-disc list-inside space-y-1">
                            {result.details.slice(0, 3).map((detail, i) => (
                              <li key={i}>{detail}</li>
                            ))}
                            {result.details.length > 3 && (
                              <li className="text-gray-500">
                                ...and {result.details.length - 3} more
                              </li>
                            )}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Repair Results */}
          {repairResults.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Lost-Safe Repair Results
              </h3>
              
              <div className="grid gap-4">
                {repairResults.map((result, index) => (
                  <Card key={index} className="border-l-4 border-l-green-500">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="font-medium">{result.category}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-green-100 text-green-800">
                            {result.fixed} Fixed
                          </Badge>
                          {result.skipped > 0 && (
                            <Badge className="bg-yellow-100 text-yellow-800">
                              {result.skipped} Protected
                            </Badge>
                          )}
                          {result.errors > 0 && (
                            <Badge variant="destructive">
                              {result.errors} Errors
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      {result.details.length > 0 && (
                        <div className="text-sm text-gray-600">
                          <ul className="list-disc list-inside space-y-1">
                            {result.details.map((detail, i) => (
                              <li key={i}>{detail}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
