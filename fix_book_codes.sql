-- SQL Script to diagnose and fix missing book codes
-- Run this in your Supabase SQL Editor

-- 1. First, let's see the current state of book codes
SELECT 
    id,
    title,
    author,
    book_code,
    CASE 
        WHEN book_code IS NULL THEN 'NULL'
        WHEN book_code = '' THEN 'EMPTY STRING'
        ELSE 'HAS CODE'
    END as code_status
FROM books 
ORDER BY 
    CASE 
        WHEN book_code IS NULL THEN 1
        WHEN book_code = '' THEN 2
        ELSE 3
    END,
    title
LIMIT 20;

-- 2. Count books by code status
SELECT 
    CASE 
        WHEN book_code IS NULL THEN 'NULL'
        WHEN book_code = '' THEN 'EMPTY STRING'
        ELSE 'HAS CODE'
    END as code_status,
    COUNT(*) as count
FROM books 
GROUP BY 
    CASE 
        WHEN book_code IS NULL THEN 'NULL'
        WHEN book_code = '' THEN 'EMPTY STRING'
        ELSE 'HAS CODE'
    END;

-- 3. Generate and update missing book codes
-- This will create codes from the first 3 letters of the title
WITH book_code_updates AS (
    SELECT 
        id,
        title,
        book_code,
        CASE 
            WHEN LENGTH(REGEXP_REPLACE(title, '[^A-Za-z]', '', 'g')) >= 3 THEN
                UPPER(SUBSTRING(REGEXP_REPLACE(title, '[^A-Za-z]', '', 'g'), 1, 3))
            WHEN LENGTH(REGEXP_REPLACE(title, '[^A-Za-z]', '', 'g')) >= 2 THEN
                UPPER(SUBSTRING(REGEXP_REPLACE(title, '[^A-Za-z]', '', 'g'), 1, 2)) || 'X'
            ELSE 
                'BK' || SUBSTRING(MD5(title), 1, 1)
        END as generated_code
    FROM books 
    WHERE book_code IS NULL OR book_code = ''
),
unique_codes AS (
    SELECT 
        id,
        title,
        book_code,
        generated_code,
        ROW_NUMBER() OVER (PARTITION BY generated_code ORDER BY title) as rn
    FROM book_code_updates
),
final_codes AS (
    SELECT 
        id,
        title,
        book_code,
        CASE 
            WHEN rn = 1 THEN generated_code
            ELSE generated_code || LPAD(rn::text, 3, '0')
        END as final_code
    FROM unique_codes
)
-- Show what codes will be generated (DON'T RUN UPDATE YET)
SELECT 
    title,
    book_code as current_code,
    final_code as new_code
FROM final_codes
ORDER BY title
LIMIT 10;

-- 4. UNCOMMENT AND RUN THIS ONLY AFTER REVIEWING THE ABOVE RESULTS
-- UPDATE books 
-- SET book_code = subquery.final_code
-- FROM (
--     WITH book_code_updates AS (
--         SELECT 
--             id,
--             title,
--             book_code,
--             CASE 
--                 WHEN LENGTH(REGEXP_REPLACE(title, '[^A-Za-z]', '', 'g')) >= 3 THEN
--                     UPPER(SUBSTRING(REGEXP_REPLACE(title, '[^A-Za-z]', '', 'g'), 1, 3))
--                 WHEN LENGTH(REGEXP_REPLACE(title, '[^A-Za-z]', '', 'g')) >= 2 THEN
--                     UPPER(SUBSTRING(REGEXP_REPLACE(title, '[^A-Za-z]', '', 'g'), 1, 2)) || 'X'
--                 ELSE 
--                     'BK' || SUBSTRING(MD5(title), 1, 1)
--             END as generated_code
--         FROM books 
--         WHERE book_code IS NULL OR book_code = ''
--     ),
--     unique_codes AS (
--         SELECT 
--             id,
--             title,
--             book_code,
--             generated_code,
--             ROW_NUMBER() OVER (PARTITION BY generated_code ORDER BY title) as rn
--         FROM book_code_updates
--     ),
--     final_codes AS (
--         SELECT 
--             id,
--             title,
--             book_code,
--             CASE 
--                 WHEN rn = 1 THEN generated_code
--                 ELSE generated_code || LPAD(rn::text, 3, '0')
--             END as final_code
--         FROM unique_codes
--     )
--     SELECT id, final_code FROM final_codes
-- ) AS subquery
-- WHERE books.id = subquery.id;

-- 5. After running the update, verify the results
-- SELECT 
--     CASE 
--         WHEN book_code IS NULL THEN 'NULL'
--         WHEN book_code = '' THEN 'EMPTY STRING'
--         ELSE 'HAS CODE'
--     END as code_status,
--     COUNT(*) as count
-- FROM books 
-- GROUP BY 
--     CASE 
--         WHEN book_code IS NULL THEN 'NULL'
--         WHEN book_code = '' THEN 'EMPTY STRING'
--         ELSE 'HAS CODE'
--     END;
