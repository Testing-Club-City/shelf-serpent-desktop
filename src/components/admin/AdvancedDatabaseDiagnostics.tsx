import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Database, Search, BookOpen, AlertTriangle, CheckCircle, Wrench, RotateCcw, RefreshCw, Settings, Zap } from 'lucide-react';

interface BookAnalysis {
  id: string;
  title: string;
  book_code: string;
  total_copies: number;
  available_copies: number;
  actual_copies: number;
  copies_data: any[];
  issue_type: string;
  recommendations: string[];
}

interface FixProgress {
  current: number;
  total: number;
  currentBook: string;
  fixed: number;
  failed: number;
}

export const AdvancedDatabaseDiagnostics: React.FC = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isFixingAll, setIsFixingAll] = useState(false);
  const [isFixingMismatched, setIsFixingMismatched] = useState(false);
  const [isFixingStatus, setIsFixingStatus] = useState(false);
  const [isFixingComprehensive, setIsFixingComprehensive] = useState(false);
  const [isFixingAllIssues, setIsFixingAllIssues] = useState(false);
  const [fixProgress, setFixProgress] = useState<FixProgress | null>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [selectedBooks, setSelectedBooks] = useState<BookAnalysis[]>([]);
  const { toast } = useToast();

  const runAdvancedDiagnostics = async () => {
    setIsAnalyzing(true);
    setAnalysis(null);

    try {
      console.log('=== ADVANCED DATABASE DIAGNOSTICS ===');
      
      // Get all books with detailed information
      const { data: allBooks, error: booksError } = await supabase
        .from('books')
        .select('*')
        .order('title');

      if (booksError) throw booksError;

      // Get all book copies with book information
      const { data: allCopies, error: copiesError } = await supabase
        .from('book_copies')
        .select(`
          *,
          books!inner(id, title, book_code)
        `);

      if (copiesError) throw copiesError;

      // Group copies by book_id
      const copiesByBookId = allCopies?.reduce((acc, copy) => {
        if (!acc[copy.book_id]) acc[copy.book_id] = [];
        acc[copy.book_id].push(copy);
        return acc;
      }, {} as Record<string, any[]>) || {};

      // Analyze each book
      const bookAnalysis: BookAnalysis[] = [];
      const issues = {
        no_copies: 0,
        mismatched_counts: 0,
        no_book_code: 0,
        duplicate_tracking: 0,
        status_issues: 0
      };

      allBooks?.forEach(book => {
        const bookCopies = copiesByBookId[book.id] || [];
        const actualCopiesCount = bookCopies.length;
        
        let issueType = 'healthy';
        const recommendations: string[] = [];

        // Check for various issues
        if (book.total_copies > 0 && actualCopiesCount === 0) {
          issueType = 'no_copies';
          issues.no_copies++;
          recommendations.push('Create missing book copies');
        } else if (book.total_copies !== actualCopiesCount) {
          issueType = 'mismatched_counts';
          issues.mismatched_counts++;
          recommendations.push(`Expected ${book.total_copies} copies, found ${actualCopiesCount}`);
        }

        if (!book.book_code) {
          issues.no_book_code++;
          recommendations.push('Generate book code');
        }

        // Check for duplicate tracking codes
        const trackingCodes = bookCopies.map(copy => copy.tracking_code).filter(Boolean);
        const uniqueTrackingCodes = new Set(trackingCodes);
        if (trackingCodes.length !== uniqueTrackingCodes.size) {
          issues.duplicate_tracking++;
          recommendations.push('Fix duplicate tracking codes');
        }

        // Check copy statuses
        const statusCounts = bookCopies.reduce((acc, copy) => {
          acc[copy.status] = (acc[copy.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        if (statusCounts.available !== book.available_copies) {
          issues.status_issues++;
          recommendations.push(`Available count mismatch: DB says ${book.available_copies}, actual available: ${statusCounts.available || 0}`);
        }

        bookAnalysis.push({
          id: book.id,
          title: book.title,
          book_code: book.book_code,
          total_copies: book.total_copies,
          available_copies: book.available_copies,
          actual_copies: actualCopiesCount,
          copies_data: bookCopies,
          issue_type: issueType,
          recommendations
        });
      });

      // Show ALL problematic books, not just first 10
      const problematicBooks = bookAnalysis.filter(book => book.issue_type !== 'healthy');

      // Check database constraints and indexes
      const { data: constraints } = await supabase
        .rpc('create_missing_book_copies'); // This will tell us if the function works

      const analysisResult = {
        summary: {
          total_books: allBooks?.length || 0,
          total_copies_records: allCopies?.length || 0,
          issues: issues,
          health_score: Math.round(((allBooks?.length || 0) - Object.values(issues).reduce((a, b) => a + b, 0)) / (allBooks?.length || 1) * 100)
        },
        book_analysis: bookAnalysis,
        problematic_books: problematicBooks,
        function_test: constraints
      };

      console.log('Advanced diagnostics completed:', analysisResult);
      setAnalysis(analysisResult);
      setSelectedBooks(problematicBooks);

      toast({
        title: 'Advanced Diagnostics Complete',
        description: `Analyzed ${allBooks?.length} books. Found ${problematicBooks.length} books with issues.`,
      });

    } catch (error: any) {
      console.error('Error running advanced diagnostics:', error);
      toast({
        title: 'Error',
        description: `Advanced diagnostics failed: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const fixAllIssues = async () => {
    setIsFixingAllIssues(true);
    setFixProgress(null);

    try {
      console.log('=== STARTING COMPREHENSIVE FIX ALL ISSUES ===');
      
      const operations = [
        { name: 'Create Missing Book Copies', operation: 'missing_copies' },
        { name: 'Fix Mismatched Counts', operation: 'mismatched_counts' },
        { name: 'Fix Status Issues', operation: 'status_issues' },
        { name: 'Generate Missing Book Codes', operation: 'book_codes' }
      ];

      setFixProgress({
        current: 0,
        total: operations.length,
        currentBook: 'Starting comprehensive fix...',
        fixed: 0,
        failed: 0
      });

      let totalFixed = 0;
      let totalFailed = 0;

      // Step 1: Create missing book copies using the database function
      console.log('=== STEP 1: CREATE MISSING BOOK COPIES ===');
      setFixProgress({
        current: 1,
        total: operations.length,
        currentBook: 'Creating missing book copies...',
        fixed: totalFixed,
        failed: totalFailed
      });

      try {
        const { data: copyCreationResults, error: copyError } = await supabase
          .rpc('create_missing_book_copies');

        if (copyError) {
          console.error('Error creating missing copies:', copyError);
          totalFailed++;
        } else {
          console.log('Missing copies creation results:', copyCreationResults);
          const copiesCreated = copyCreationResults?.reduce((sum: number, result: any) => sum + (result.copies_created || 0), 0) || 0;
          totalFixed += copiesCreated;
        }
      } catch (error: any) {
        console.error('Error in missing copies step:', error);
        totalFailed++;
      }

      // Step 2: Fix mismatched counts
      console.log('=== STEP 2: FIX MISMATCHED COUNTS ===');
      setFixProgress({
        current: 2,
        total: operations.length,
        currentBook: 'Fixing mismatched counts...',
        fixed: totalFixed,
        failed: totalFailed
      });

      try {
        // Get all books with their actual copy counts
        const { data: allBooks, error: booksError } = await supabase
          .from('books')
          .select('id, title, total_copies, available_copies');

        if (booksError) throw booksError;

        const { data: allCopies, error: copiesError } = await supabase
          .from('book_copies')
          .select('book_id, status');

        if (copiesError) throw copiesError;

        // Group copies by book_id and count them
        const copiesByBookId = allCopies?.reduce((acc, copy) => {
          if (!acc[copy.book_id]) {
            acc[copy.book_id] = { total: 0, available: 0 };
          }
          acc[copy.book_id].total++;
          if (copy.status === 'available') {
            acc[copy.book_id].available++;
          }
          return acc;
        }, {} as Record<string, { total: number; available: number }>) || {};

        // Find books with mismatched counts
        const booksToFix = (allBooks || []).filter(book => {
          const actualCounts = copiesByBookId[book.id] || { total: 0, available: 0 };
          return book.total_copies !== actualCounts.total || book.available_copies !== actualCounts.available;
        });

        // Process books in smaller batches
        for (const book of booksToFix) {
          const actualCounts = copiesByBookId[book.id] || { total: 0, available: 0 };
          
          try {
            const { error: updateError } = await supabase
              .from('books')
              .update({
                total_copies: actualCounts.total,
                available_copies: actualCounts.available
              })
              .eq('id', book.id);

            if (updateError) {
              console.error(`Error updating book ${book.title}:`, updateError);
              totalFailed++;
            } else {
              totalFixed++;
            }
          } catch (error: any) {
            console.error(`Error fixing book ${book.title}:`, error);
            totalFailed++;
          }
        }

      } catch (error: any) {
        console.error('Error in mismatched counts step:', error);
        totalFailed++;
      }

      // Step 3: Fix status issues  
      console.log('=== STEP 3: FIX STATUS ISSUES ===');
      setFixProgress({
        current: 3,
        total: operations.length,
        currentBook: 'Fixing status issues...',
        fixed: totalFixed,
        failed: totalFailed
      });

      try {
        // Get all books with detailed information
        const { data: allBooks, error: booksError } = await supabase
          .from('books')
          .select('id, title, total_copies, available_copies, status');

        if (booksError) throw booksError;

        // Get all book copies with their current status
        const { data: allCopies, error: copiesError } = await supabase
          .from('book_copies')
          .select('book_id, status, id');

        if (copiesError) throw copiesError;

        // Get all active borrowings
        const { data: activeBorrowings, error: borrowingsError } = await supabase
          .from('borrowings')
          .select('book_copy_id, status')
          .eq('status', 'active');

        if (borrowingsError) throw borrowingsError;

        // Create a set of borrowed copy IDs
        const borrowedCopyIds = new Set(activeBorrowings?.map(b => b.book_copy_id) || []);

        // Group copies by book_id
        const copiesByBookId = allCopies?.reduce((acc, copy) => {
          if (!acc[copy.book_id]) {
            acc[copy.book_id] = [];
          }
          acc[copy.book_id].push(copy);
          return acc;
        }, {} as Record<string, any[]>) || {};

        const booksToFix = [];
        const copyStatusUpdates = [];

        // Analyze each book for status issues
        (allBooks || []).forEach(book => {
          const bookCopies = copiesByBookId[book.id] || [];
          let actualAvailableCount = 0;
          let actualTotalCount = bookCopies.length;

          // Check each copy for status consistency
          bookCopies.forEach(copy => {
            // All copies should be marked as "available" in the book_copies table
            // unless they are damaged or lost
            if (copy.status !== 'available' && !['damaged', 'lost'].includes(copy.status)) {
              copyStatusUpdates.push({
                id: copy.id,
                status: 'available',
                book_title: book.title
              });
            }

            // Count available copies (not actively borrowed)
            if (!borrowedCopyIds.has(copy.id) && copy.status === 'available') {
              actualAvailableCount++;
            }
          });

          // Check if book counts need updating
          if (book.total_copies !== actualTotalCount || book.available_copies !== actualAvailableCount) {
            // Determine correct book status
            let correctBookStatus = 'available';
            if (actualTotalCount === 0) {
              correctBookStatus = 'unavailable';
            } else if (actualAvailableCount === 0) {
              correctBookStatus = 'unavailable'; // All copies are borrowed
            }

            booksToFix.push({
              id: book.id,
              title: book.title,
              updates: {
                total_copies: actualTotalCount,
                available_copies: actualAvailableCount,
                status: correctBookStatus
              }
            });
          }
        });

        // Fix copy statuses
        for (const update of copyStatusUpdates) {
          try {
            const { error: updateError } = await supabase
              .from('book_copies')
              .update({ status: update.status })
              .eq('id', update.id);

            if (updateError) {
              console.error(`Error updating copy ${update.id}:`, updateError);
              totalFailed++;
            } else {
              totalFixed++;
            }
          } catch (error: any) {
            console.error(`Error fixing copy ${update.id}:`, error);
            totalFailed++;
          }
        }

        // Fix book statuses and counts
        for (const book of booksToFix) {
          try {
            const { error: updateError } = await supabase
              .from('books')
              .update(book.updates)
              .eq('id', book.id);

            if (updateError) {
              console.error(`Error updating book ${book.title}:`, updateError);
              totalFailed++;
            } else {
              totalFixed++;
            }
          } catch (error: any) {
            console.error(`Error fixing book ${book.title}:`, error);
            totalFailed++;
          }
        }

      } catch (error: any) {
        console.error('Error in status issues step:', error);
        totalFailed++;
      }

      // Step 4: Generate missing book codes
      console.log('=== STEP 4: GENERATE MISSING BOOK CODES ===');
      setFixProgress({
        current: 4,
        total: operations.length,
        currentBook: 'Generating missing book codes...',
        fixed: totalFixed,
        failed: totalFailed
      });

      try {
        // Get books without book codes
        const { data: booksWithoutCodes, error: booksError } = await supabase
          .from('books')
          .select('id, title, book_code')
          .or('book_code.is.null,book_code.eq.');

        if (booksError) throw booksError;

        // Generate book codes for books that don't have them
        for (const book of (booksWithoutCodes || [])) {
          try {
            // Generate a simple book code from title
            let baseCode = 'BK';
            if (book.title && book.title.length >= 3) {
              baseCode = book.title.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, '');
              if (baseCode.length < 2) baseCode = 'BK';
            }

            // Check if code exists and find unique variant
            let codeCounter = 1;
            let candidateCode = baseCode;
            
            while (true) {
              const { data: existingBook } = await supabase
                .from('books')
                .select('id')
                .eq('book_code', candidateCode)
                .single();

              if (!existingBook) break;
              
              candidateCode = baseCode + String(codeCounter).padStart(3, '0');
              codeCounter++;
              
              if (codeCounter > 999) {
                candidateCode = 'BK' + Math.random().toString(36).substring(2, 8).toUpperCase();
                break;
              }
            }

            const { error: updateError } = await supabase
              .from('books')
              .update({ book_code: candidateCode })
              .eq('id', book.id);

            if (updateError) {
              console.error(`Error updating book code for ${book.title}:`, updateError);
              totalFailed++;
            } else {
              totalFixed++;
            }
          } catch (error: any) {
            console.error(`Error generating book code for ${book.title}:`, error);
            totalFailed++;
          }
        }

      } catch (error: any) {
        console.error('Error in book codes step:', error);
        totalFailed++;
      }

      // Final progress update
      setFixProgress({
        current: operations.length,
        total: operations.length,
        currentBook: 'All operations completed!',
        fixed: totalFixed,
        failed: totalFailed
      });

      console.log('=== COMPREHENSIVE FIX COMPLETED ===');
      console.log(`Total Fixed: ${totalFixed}, Total Failed: ${totalFailed}`);

      toast({
        title: 'All Issues Fixed',
        description: `Fixed ${totalFixed} issues across all categories, ${totalFailed} failed. Refreshing diagnostics...`,
      });
      
      // Refresh the analysis after fixing
      setTimeout(() => {
        setFixProgress(null);
        runAdvancedDiagnostics();
      }, 2000);

    } catch (error: any) {
      console.error('Error in comprehensive fix operation:', error);
      toast({
        title: 'Error',
        description: `Comprehensive fix failed: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setIsFixingAllIssues(false);
    }
  };

  const fixMismatchedCounts = async () => {
    setIsFixingMismatched(true);
    setFixProgress(null);

    try {
      console.log('Starting to fix mismatched counts with progress tracking...');
      
      // Get all books with their actual copy counts
      const { data: allBooks, error: booksError } = await supabase
        .from('books')
        .select('id, title, total_copies, available_copies');

      if (booksError) throw booksError;

      const { data: allCopies, error: copiesError } = await supabase
        .from('book_copies')
        .select('book_id, status');

      if (copiesError) throw copiesError;

      // Group copies by book_id and count them
      const copiesByBookId = allCopies?.reduce((acc, copy) => {
        if (!acc[copy.book_id]) {
          acc[copy.book_id] = { total: 0, available: 0 };
        }
        acc[copy.book_id].total++;
        if (copy.status === 'available') {
          acc[copy.book_id].available++;
        }
        return acc;
      }, {} as Record<string, { total: number; available: number }>) || {};

      // Find books with mismatched counts
      const booksToFix = (allBooks || []).filter(book => {
        const actualCounts = copiesByBookId[book.id] || { total: 0, available: 0 };
        return book.total_copies !== actualCounts.total || book.available_copies !== actualCounts.available;
      });

      console.log(`Found ${booksToFix.length} books with mismatched counts`);

      // Initialize progress
      setFixProgress({
        current: 0,
        total: booksToFix.length,
        currentBook: '',
        fixed: 0,
        failed: 0
      });

      let fixedCount = 0;
      let failedCount = 0;

      // Process books in smaller batches to show progress
      for (let i = 0; i < booksToFix.length; i++) {
        const book = booksToFix[i];
        const actualCounts = copiesByBookId[book.id] || { total: 0, available: 0 };
        
        // Update progress
        setFixProgress({
          current: i + 1,
          total: booksToFix.length,
          currentBook: book.title,
          fixed: fixedCount,
          failed: failedCount
        });

        try {
          console.log(`Fixing counts for book: ${book.title}`);
          console.log(`  Current DB: total=${book.total_copies}, available=${book.available_copies}`);
          console.log(`  Actual: total=${actualCounts.total}, available=${actualCounts.available}`);
          
          const { error: updateError } = await supabase
            .from('books')
            .update({
              total_copies: actualCounts.total,
              available_copies: actualCounts.available
            })
            .eq('id', book.id);

          if (updateError) {
            console.error(`Error updating book ${book.title}:`, updateError);
            failedCount++;
          } else {
            console.log(`Successfully updated counts for ${book.title}`);
            fixedCount++;
          }
        } catch (error: any) {
          console.error(`Error fixing book ${book.title}:`, error);
          failedCount++;
        }

        // Small delay to allow UI updates and prevent overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Final progress update
      setFixProgress({
        current: booksToFix.length,
        total: booksToFix.length,
        currentBook: 'Completed!',
        fixed: fixedCount,
        failed: failedCount
      });

      toast({
        title: 'Mismatched Counts Fixed',
        description: `Fixed ${fixedCount} books, ${failedCount} failed. Refreshing diagnostics...`,
      });
      
      // Refresh the analysis after fixing
      setTimeout(() => {
        setFixProgress(null);
        runAdvancedDiagnostics();
      }, 2000);

    } catch (error: any) {
      console.error('Error in fix mismatched counts operation:', error);
      toast({
        title: 'Error',
        description: `Fix mismatched counts operation failed: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setIsFixingMismatched(false);
    }
  };

  const fixStatusIssues = async () => {
    setIsFixingStatus(true);
    setFixProgress(null);

    try {
      console.log('=== ENHANCED STATUS ISSUES FIX ===');
      console.log('Starting comprehensive status issues analysis...');
      
      // Get all books with detailed information
      const { data: allBooks, error: booksError } = await supabase
        .from('books')
        .select('id, title, total_copies, available_copies, status');

      if (booksError) throw booksError;

      // Get all book copies with their current status
      const { data: allCopies, error: copiesError } = await supabase
        .from('book_copies')
        .select('book_id, status, id');

      if (copiesError) throw copiesError;

      // Get all active borrowings to cross-reference
      const { data: activeBorrowings, error: borrowingsError } = await supabase
        .from('borrowings')
        .select('book_copy_id, status, book_id')
        .eq('status', 'active');

      if (borrowingsError) throw borrowingsError;

      console.log(`Analyzing ${allBooks?.length} books, ${allCopies?.length} copies, ${activeBorrowings?.length} active borrowings`);

      // Create lookup maps
      const activeBorrowedCopyIds = new Set(activeBorrowings?.map(b => b.book_copy_id) || []);
      console.log('Active borrowed copy IDs:', Array.from(activeBorrowedCopyIds));

      // Group copies by book_id and analyze status issues
      const copiesByBookId = allCopies?.reduce((acc, copy) => {
        if (!acc[copy.book_id]) {
          acc[copy.book_id] = [];
        }
        acc[copy.book_id].push(copy);
        return acc;
      }, {} as Record<string, any[]>) || {};

      console.log('Copies grouped by book ID:', Object.keys(copiesByBookId).length, 'books have copies');

      const booksToFix = [];
      const copyStatusUpdates = [];
      let totalIssuesFound = 0;

      // Analyze each book for comprehensive status issues
      (allBooks || []).forEach(book => {
        const bookCopies = copiesByBookId[book.id] || [];
        const totalCopiesActual = bookCopies.length;
        
        // Count copies by their current status
        const copyStatusCounts = bookCopies.reduce((acc, copy) => {
          acc[copy.status] = (acc[copy.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        // Count copies that should be available based on borrowings table
        // Note: All copies should remain "available" in the copies table
        // The borrowing status is tracked separately in the borrowings table
        let actualAvailableCount = 0;
        
        bookCopies.forEach(copy => {
          // All copies should be marked as "available" in the book_copies table
          // The borrowing is tracked in the borrowings table
          if (copy.status !== 'available' && !['damaged', 'lost'].includes(copy.status)) {
            console.log(`Copy ${copy.id} has invalid status: ${copy.status}, should be available`);
            copyStatusUpdates.push({
              id: copy.id,
              currentStatus: copy.status,
              correctStatus: 'available',
              reason: 'invalid_copy_status'
            });
            totalIssuesFound++;
          }
          
          // Count available copies (not actively borrowed)
          if (!activeBorrowedCopyIds.has(copy.id) && copy.status === 'available') {
            actualAvailableCount++;
          }
        });

        // Check if book counts need updating
        const needsBookUpdate = 
          book.total_copies !== totalCopiesActual || 
          book.available_copies !== actualAvailableCount;

        // Determine correct book status
        let correctBookStatus = book.status;
        if (totalCopiesActual === 0) {
          correctBookStatus = 'unavailable';
        } else if (actualAvailableCount === 0) {
          correctBookStatus = 'unavailable'; // All copies are borrowed
        } else if (actualAvailableCount > 0) {
          correctBookStatus = 'available';
        }

        if (needsBookUpdate || book.status !== correctBookStatus) {
          console.log(`Book "${book.title}" needs updating:`, {
            currentTotalCopies: book.total_copies,
            actualTotalCopies: totalCopiesActual,
            currentAvailableCopies: book.available_copies,
            actualAvailableCopies: actualAvailableCount,
            currentStatus: book.status,
            correctStatus: correctBookStatus,
            copyStatusCounts,
            activeBorrowedCopies: bookCopies.filter(copy => activeBorrowedCopyIds.has(copy.id)).length
          });

          booksToFix.push({
            id: book.id,
            title: book.title,
            updates: {
              total_copies: totalCopiesActual,
              available_copies: actualAvailableCount,
              status: correctBookStatus
            },
            currentValues: {
              total_copies: book.total_copies,
              available_copies: book.available_copies,
              status: book.status
            }
          });
          totalIssuesFound++;
        }
      });

      console.log(`=== STATUS ANALYSIS RESULTS ===`);
      console.log(`Total issues found: ${totalIssuesFound}`);
      console.log(`Copy status updates needed: ${copyStatusUpdates.length}`);
      console.log(`Book record updates needed: ${booksToFix.length}`);
      console.log('Copy status updates:', copyStatusUpdates);
      console.log('Books to fix:', booksToFix);

      // Initialize progress
      const totalUpdates = copyStatusUpdates.length + booksToFix.length;
      if (totalUpdates === 0) {
        toast({
          title: 'No Status Issues Found',
          description: 'All book and copy statuses appear to be correct.',
        });
        return;
      }

      setFixProgress({
        current: 0,
        total: totalUpdates,
        currentBook: 'Starting enhanced status fix...',
        fixed: 0,
        failed: 0
      });

      let fixedCount = 0;
      let failedCount = 0;
      let currentProgress = 0;

      // Fix copy statuses first
      console.log('=== FIXING COPY STATUSES ===');
      for (const update of copyStatusUpdates) {
        currentProgress++;
        setFixProgress({
          current: currentProgress,
          total: totalUpdates,
          currentBook: `Fixing copy status (${update.reason})`,
          fixed: fixedCount,
          failed: failedCount
        });

        try {
          console.log(`Updating copy ${update.id} from ${update.currentStatus} to ${update.correctStatus}`);
          
          const { error: updateError } = await supabase
            .from('book_copies')
            .update({ status: update.correctStatus })
            .eq('id', update.id);

          if (updateError) {
            console.error(`Error updating copy ${update.id}:`, updateError);
            failedCount++;
          } else {
            console.log(`Successfully updated copy ${update.id}`);
            fixedCount++;
          }
        } catch (error: any) {
          console.error(`Error fixing copy ${update.id}:`, error);
          failedCount++;
        }

        await new Promise(resolve => setTimeout(resolve, 30));
      }

      // Fix book statuses and counts
      console.log('=== FIXING BOOK RECORDS ===');
      for (const book of booksToFix) {
        currentProgress++;
        setFixProgress({
          current: currentProgress,
          total: totalUpdates,
          currentBook: `Fixing book: ${book.title}`,
          fixed: fixedCount,
          failed: failedCount
        });

        try {
          console.log(`Updating book "${book.title}":`, book.updates);
          
          const { error: updateError } = await supabase
            .from('books')
            .update(book.updates)
            .eq('id', book.id);

          if (updateError) {
            console.error(`Error updating book ${book.title}:`, updateError);
            failedCount++;
          } else {
            console.log(`Successfully updated book "${book.title}"`);
            fixedCount++;
          }
        } catch (error: any) {
          console.error(`Error fixing book ${book.title}:`, error);
          failedCount++;
        }

        await new Promise(resolve => setTimeout(resolve, 30));
      }

      // Final progress update
      setFixProgress({
        current: totalUpdates,
        total: totalUpdates,
        currentBook: 'Completed!',
        fixed: fixedCount,
        failed: failedCount
      });

      console.log('=== STATUS FIX COMPLETED ===');
      console.log(`Fixed: ${fixedCount}, Failed: ${failedCount}`);

      toast({
        title: 'Enhanced Status Fix Complete',
        description: `Fixed ${fixedCount} status issues (${copyStatusUpdates.length} copies, ${booksToFix.length} books), ${failedCount} failed. Refreshing diagnostics...`,
      });
      
      // Refresh the analysis after fixing
      setTimeout(() => {
        setFixProgress(null);
        runAdvancedDiagnostics();
      }, 2000);

    } catch (error: any) {
      console.error('Error in enhanced status fix operation:', error);
      toast({
        title: 'Error',
        description: `Enhanced status fix failed: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setIsFixingStatus(false);
    }
  };

  const fixComprehensiveStatusIssues = async () => {
    setIsFixingComprehensive(true);
    setFixProgress(null);

    try {
      console.log('Starting comprehensive status fix with detailed analysis...');
      
      // Get all books with their copies and borrowing information
      const { data: allBooks, error: booksError } = await supabase
        .from('books')
        .select('id, title, total_copies, available_copies, status');

      if (booksError) throw booksError;

      // Get all book copies with their current status
      const { data: allCopies, error: copiesError } = await supabase
        .from('book_copies')
        .select('book_id, status, id');

      if (copiesError) throw copiesError;

      // Get all active borrowings
      const { data: activeBorrowings, error: borrowingsError } = await supabase
        .from('borrowings')
        .select('book_copy_id, status')
        .eq('status', 'active');

      if (borrowingsError) throw borrowingsError;

      // Create a set of borrowed copy IDs
      const borrowedCopyIds = new Set(activeBorrowings?.map(b => b.book_copy_id) || []);

      console.log(`Found ${borrowedCopyIds.size} actively borrowed copies`);

      // Group copies by book_id and analyze status issues
      const copiesByBookId = allCopies?.reduce((acc, copy) => {
        if (!acc[copy.book_id]) {
          acc[copy.book_id] = [];
        }
        acc[copy.book_id].push(copy);
        return acc;
      }, {} as Record<string, any[]>) || {};

      const booksToFix = [];
      const copyStatusUpdates = [];

      // Analyze each book for comprehensive status issues
      (allBooks || []).forEach(book => {
        const bookCopies = copiesByBookId[book.id] || [];
        let needsBookUpdate = false;
        let actualAvailableCount = 0;
        let actualTotalCount = bookCopies.length;

        // Check each copy for status consistency
        bookCopies.forEach(copy => {
          const isBorrowed = borrowedCopyIds.has(copy.id);
          const shouldBeAvailable = !isBorrowed;
          const isCurrentlyAvailable = copy.status === 'available';

          // If copy status doesn't match borrowing reality
          if (shouldBeAvailable && !isCurrentlyAvailable) {
            console.log(`Copy ${copy.id} should be available but is marked as ${copy.status}`);
            copyStatusUpdates.push({
              id: copy.id,
              status: 'available',
              book_title: book.title
            });
          } else if (!shouldBeAvailable && isCurrentlyAvailable) {
            console.log(`Copy ${copy.id} should be borrowed but is marked as available`);
            copyStatusUpdates.push({
              id: copy.id,
              status: 'borrowed',
              book_title: book.title
            });
          }

          // Count actual available copies (not borrowed and should be available)
          if (shouldBeAvailable) {
            actualAvailableCount++;
          }
        });

        // Check if book counts need updating
        if (book.total_copies !== actualTotalCount || book.available_copies !== actualAvailableCount) {
          needsBookUpdate = true;
        }

        // Check if book overall status needs updating
        let correctBookStatus = 'available';
        if (actualTotalCount === 0) {
          correctBookStatus = 'unavailable';
        } else if (actualAvailableCount === 0) {
          correctBookStatus = 'unavailable';
        }

        if (needsBookUpdate || book.status !== correctBookStatus) {
          booksToFix.push({
            id: book.id,
            title: book.title,
            current_total: book.total_copies,
            actual_total: actualTotalCount,
            current_available: book.available_copies,
            actual_available: actualAvailableCount,
            current_status: book.status,
            correct_status: correctBookStatus
          });
        }
      });

      console.log(`Found ${copyStatusUpdates.length} copy status issues and ${booksToFix.length} book status issues`);

      // Initialize progress
      const totalUpdates = copyStatusUpdates.length + booksToFix.length;
      setFixProgress({
        current: 0,
        total: totalUpdates,
        currentBook: 'Starting...',
        fixed: 0,
        failed: 0
      });

      let fixedCount = 0;
      let failedCount = 0;
      let currentProgress = 0;

      // Fix copy statuses first
      for (const update of copyStatusUpdates) {
        currentProgress++;
        setFixProgress({
          current: currentProgress,
          total: totalUpdates,
          currentBook: `Fixing copy for ${update.book_title}`,
          fixed: fixedCount,
          failed: failedCount
        });

        try {
          const { error: updateError } = await supabase
            .from('book_copies')
            .update({ status: update.status })
            .eq('id', update.id);

          if (updateError) {
            console.error(`Error updating copy ${update.id}:`, updateError);
            failedCount++;
          } else {
            console.log(`Successfully updated copy ${update.id} to ${update.status}`);
            fixedCount++;
          }
        } catch (error: any) {
          console.error(`Error fixing copy ${update.id}:`, error);
          failedCount++;
        }

        await new Promise(resolve => setTimeout(resolve, 30));
      }

      // Fix book statuses and counts
      for (const book of booksToFix) {
        currentProgress++;
        setFixProgress({
          current: currentProgress,
          total: totalUpdates,
          currentBook: `Fixing book ${book.title}`,
          fixed: fixedCount,
          failed: failedCount
        });

        try {
          const { error: updateError } = await supabase
            .from('books')
            .update({
              total_copies: book.actual_total,
              available_copies: book.actual_available,
              status: book.correct_status
            })
            .eq('id', book.id);

          if (updateError) {
            console.error(`Error updating book ${book.title}:`, updateError);
            failedCount++;
          } else {
            console.log(`Successfully updated book ${book.title}`);
            fixedCount++;
          }
        } catch (error: any) {
          console.error(`Error fixing book ${book.title}:`, error);
          failedCount++;
        }

        await new Promise(resolve => setTimeout(resolve, 30));
      }

      // Final progress update
      setFixProgress({
        current: totalUpdates,
        total: totalUpdates,
        currentBook: 'Completed!',
        fixed: fixedCount,
        failed: failedCount
      });

      toast({
        title: 'Comprehensive Status Fix Complete',
        description: `Fixed ${fixedCount} issues (${copyStatusUpdates.length} copies, ${booksToFix.length} books), ${failedCount} failed. Refreshing diagnostics...`,
      });
      
      // Refresh the analysis after fixing
      setTimeout(() => {
        setFixProgress(null);
        runAdvancedDiagnostics();
      }, 2000);

    } catch (error: any) {
      console.error('Error in comprehensive status fix operation:', error);
      toast({
        title: 'Error',
        description: `Comprehensive status fix failed: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setIsFixingComprehensive(false);
    }
  };

  const fixAllProblems = async () => {
    setIsFixingAll(true);
    let fixedCount = 0;
    let failedCount = 0;

    try {
      console.log('Starting to fix all problems...');
      
      for (const book of selectedBooks) {
        try {
          console.log(`Fixing book: ${book.title}`);
          
          // Fix mismatched counts by updating the book record to match actual copies
          if (book.issue_type === 'mismatched_counts') {
            const availableCopies = book.copies_data.filter(copy => copy.status === 'available').length;
            
            const { error: updateError } = await supabase
              .from('books')
              .update({
                total_copies: book.actual_copies,
                available_copies: availableCopies
              })
              .eq('id', book.id);

            if (updateError) {
              console.error(`Error updating book ${book.title}:`, updateError);
              failedCount++;
            } else {
              console.log(`Successfully updated counts for ${book.title}`);
              fixedCount++;
            }
          }
          
          // Fix books with no copies by creating them
          else if (book.issue_type === 'no_copies') {
            await fixSpecificBook(book.id);
            fixedCount++;
          }
          
          // Add a small delay to prevent overwhelming the database
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error: any) {
          console.error(`Error fixing book ${book.title}:`, error);
          failedCount++;
        }
      }

      toast({
        title: 'Fix All Complete',
        description: `Fixed ${fixedCount} books, ${failedCount} failed. Refreshing diagnostics...`,
      });
      
      // Refresh the analysis
      setTimeout(() => runAdvancedDiagnostics(), 1000);

    } catch (error: any) {
      console.error('Error in fix all operation:', error);
      toast({
        title: 'Error',
        description: `Fix all operation failed: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setIsFixingAll(false);
    }
  };

  const fixSpecificBook = async (bookId: string) => {
    try {
      console.log(`Attempting to fix book ${bookId}...`);
      
      // Get the book details
      const book = selectedBooks.find(b => b.id === bookId);
      if (!book) return;

      // Get all existing copy numbers for this book to find gaps
      const { data: existingCopies, error: fetchError } = await supabase
        .from('book_copies')
        .select('copy_number')
        .eq('book_id', bookId)
        .order('copy_number');

      if (fetchError) {
        console.error('Error fetching existing copies:', fetchError);
        toast({
          title: 'Error',
          description: `Failed to fetch existing copies: ${fetchError.message}`,
          variant: 'destructive',
        });
        return;
      }

      // Find which copy numbers are missing
      const existingNumbers = new Set(existingCopies.map(c => c.copy_number));
      const neededCopies = book.total_copies - book.actual_copies;
      
      if (neededCopies <= 0) {
        toast({
          title: 'Info',
          description: 'No copies need to be created for this book.',
        });
        return;
      }

      // Find available copy numbers (fill gaps first, then add new ones)
      const copiesToCreate = [];
      let copyNumber = 1;
      
      while (copiesToCreate.length < neededCopies) {
        if (!existingNumbers.has(copyNumber)) {
          const trackingCode = `${book.book_code || 'BK'}-${String(copyNumber).padStart(2, '0')}`;
          
          copiesToCreate.push({
            book_id: bookId,
            copy_number: copyNumber,
            book_code: book.book_code || `BK${copyNumber}`,
            tracking_code: trackingCode,
            status: 'available',
            condition: 'good'
          });
        }
        copyNumber++;
        
        // Safety check to prevent infinite loop
        if (copyNumber > 1000) {
          console.error('Safety limit reached while finding copy numbers');
          break;
        }
      }

      console.log('Creating copies:', copiesToCreate);

      const { data, error } = await supabase
        .from('book_copies')
        .insert(copiesToCreate)
        .select();

      if (error) {
        console.error('Error creating copies:', error);
        toast({
          title: 'Error',
          description: `Failed to create copies: ${error.message}`,
          variant: 'destructive',
        });
        return;
      }

      console.log('Successfully created copies:', data);

      // Update the book's total_copies and available_copies counts
      const { data: allCopiesForBook, error: countError } = await supabase
        .from('book_copies')
        .select('status')
        .eq('book_id', bookId);

      if (countError) {
        console.error('Error counting copies:', countError);
      } else {
        const totalCopies = allCopiesForBook.length;
        const availableCopies = allCopiesForBook.filter(copy => copy.status === 'available').length;

        const { error: updateError } = await supabase
          .from('books')
          .update({
            total_copies: totalCopies,
            available_copies: availableCopies
          })
          .eq('id', bookId);

        if (updateError) {
          console.error('Error updating book counts:', updateError);
          toast({
            title: 'Warning',
            description: 'Copies created but book counts may not be updated correctly.',
            variant: 'destructive',
          });
        } else {
          console.log('Successfully updated book counts:', { totalCopies, availableCopies });
        }
      }

      toast({
        title: 'Success',
        description: `Created ${copiesToCreate.length} copies for "${book.title}"`,
      });
      
      // Refresh the analysis
      setTimeout(() => runAdvancedDiagnostics(), 1000);

    } catch (error: any) {
      console.error('Error fixing book:', error);
      toast({
        title: 'Error',
        description: `Failed to fix book: ${error.message}`,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Advanced Database Diagnostics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Search className="h-4 w-4" />
            <AlertDescription>
              This tool performs deep database analysis to identify and fix book copy issues.
            </AlertDescription>
          </Alert>

          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={runAdvancedDiagnostics}
              disabled={isAnalyzing}
              className="flex-1"
            >
              {isAnalyzing ? 'Analyzing Database...' : 'Run Advanced Diagnostics'}
            </Button>

            {analysis && Object.values(analysis.summary.issues).some((count: number) => count > 0) && (
              <Button
                onClick={fixAllIssues}
                disabled={isFixingAllIssues || isAnalyzing}
                variant="destructive"
                className="flex items-center gap-2"
              >
                <Zap className="w-4 h-4" />
                {isFixingAllIssues ? 'Fixing All...' : 'Fix All Issues at Once'}
              </Button>
            )}

            {analysis && analysis.summary.issues.mismatched_counts > 0 && (
              <Button
                onClick={fixMismatchedCounts}
                disabled={isFixingMismatched || isAnalyzing}
                variant="outline"
                className="flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                {isFixingMismatched ? 'Fixing...' : `Fix Mismatched Counts (${analysis.summary.issues.mismatched_counts})`}
              </Button>
            )}

            {analysis && analysis.summary.issues.status_issues > 0 && (
              <Button
                onClick={fixStatusIssues}
                disabled={isFixingStatus || isAnalyzing}
                variant="outline"
                className="flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                {isFixingStatus ? 'Fixing...' : `Fix Status Issues (${analysis.summary.issues.status_issues})`}
              </Button>
            )}

            {analysis && analysis.summary.issues.status_issues > 0 && (
              <Button
                onClick={fixComprehensiveStatusIssues}
                disabled={isFixingComprehensive || isAnalyzing}
                variant="secondary"
                className="flex items-center gap-2"
              >
                <Settings className="w-4 h-4" />
                {isFixingComprehensive ? 'Fixing...' : `Comprehensive Fix (${analysis.summary.issues.status_issues})`}
              </Button>
            )}

            {selectedBooks.length > 0 && (
              <Button
                onClick={fixAllProblems}
                disabled={isFixingAll || isAnalyzing}
                variant="secondary"
                className="flex items-center gap-2"
              >
                <Wrench className="w-4 h-4" />
                {isFixingAll ? 'Fixing All...' : `Fix All Problems (${selectedBooks.length})`}
              </Button>
            )}
          </div>

          {/* Progress Bar for Fix Operations */}
          {fixProgress && (
            <div className="space-y-3 p-4 bg-blue-50 rounded-lg">
              <div className="flex justify-between text-sm">
                <span>
                  {isFixingAllIssues && 'Fixing all issues comprehensively...'}
                  {isFixingMismatched && 'Fixing mismatched counts...'}
                  {isFixingStatus && 'Fixing status issues...'}
                  {isFixingComprehensive && 'Running comprehensive status fix...'}
                  {isFixingAll && 'Fixing all problems...'}
                </span>
                <span>{fixProgress.current}/{fixProgress.total}</span>
              </div>
              <Progress value={(fixProgress.current / fixProgress.total) * 100} className="h-2" />
              <div className="grid grid-cols-3 gap-4 text-xs text-gray-600">
                <div>Current: {fixProgress.currentBook}</div>
                <div>Fixed: {fixProgress.fixed}</div>
                <div>Failed: {fixProgress.failed}</div>
              </div>
            </div>
          )}

          {analysis && (
            <div className="space-y-6">
              {/* Summary Dashboard */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{analysis.summary.total_books}</div>
                  <div className="text-sm text-gray-600">Total Books</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{analysis.summary.total_copies_records}</div>
                  <div className="text-sm text-gray-600">Copy Records</div>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{selectedBooks.length}</div>
                  <div className="text-sm text-gray-600">Books with Issues</div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">{analysis.summary.health_score}%</div>
                  <div className="text-sm text-gray-600">Health Score</div>
                </div>
              </div>

              {/* Issues Breakdown */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium mb-3">Issues Breakdown</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>No Copies: <span className="font-medium">{analysis.summary.issues.no_copies}</span></div>
                  <div>Mismatched Counts: <span className="font-medium">{analysis.summary.issues.mismatched_counts}</span></div>
                  <div>No Book Code: <span className="font-medium">{analysis.summary.issues.no_book_code}</span></div>
                  <div>Duplicate Tracking: <span className="font-medium">{analysis.summary.issues.duplicate_tracking}</span></div>
                  <div>Status Issues: <span className="font-medium">{analysis.summary.issues.status_issues}</span></div>
                </div>
              </div>

              {/* Function Test Result */}
              {analysis.function_test && (
                <div className="p-4 bg-green-50 rounded-lg">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    Database Function Test
                  </h4>
                  <div className="text-sm text-green-700">
                    Function executed successfully. Processed {analysis.function_test.length} books.
                  </div>
                </div>
              )}

              {/* Problematic Books */}
              {selectedBooks.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-600" />
                    Books Requiring Attention ({selectedBooks.length})
                  </h4>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {selectedBooks.map((book, index) => (
                      <div key={index} className="p-3 border rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="font-medium">{book.title}</div>
                            <div className="text-sm text-gray-600">
                              Code: {book.book_code || 'NONE'} | 
                              Expected: {book.total_copies} | 
                              Actual: {book.actual_copies} | 
                              Available: {book.available_copies}
                            </div>
                          </div>
                          {(book.issue_type === 'no_copies' || book.issue_type === 'mismatched_counts') && (
                            <Button
                              size="sm"
                              onClick={() => fixSpecificBook(book.id)}
                              className="ml-2"
                            >
                              Fix Now
                            </Button>
                          )}
                        </div>
                        
                        <div className="text-xs space-y-1">
                          <div className="text-red-600 font-medium">Issue: {book.issue_type.replace('_', ' ').toUpperCase()}</div>
                          {book.recommendations.map((rec, i) => (
                            <div key={i} className="text-gray-600">• {rec}</div>
                          ))}
                        </div>

                        {book.copies_data.length > 0 && (
                          <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                            <div className="font-medium">Existing Copies:</div>
                            {book.copies_data.slice(0, 3).map((copy, i) => (
                              <div key={i}>
                                #{copy.copy_number} - {copy.tracking_code} ({copy.status})
                              </div>
                            ))}
                            {book.copies_data.length > 3 && (
                              <div>... and {book.copies_data.length - 3} more</div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
