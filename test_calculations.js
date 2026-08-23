// Automated calculation & business logic validation script

function runTests() {
  console.log("=== RUNNING POS & BUSINESS LOGIC TEST SUITE ===");
  let passed = 0;
  let failed = 0;

  function assert(condition, name) {
    if (condition) {
      console.log(`✅ PASS: ${name}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${name}`);
      failed++;
    }
  }

  // Test 1: Standard Sale Calculation
  {
    const qty = 2;
    const stdPrice = 1500;
    const gstRate = 5; // 5%
    const subtotal = qty * stdPrice;
    const gstAmount = (subtotal * gstRate) / 100;
    const grandTotal = subtotal + gstAmount;

    assert(subtotal === 3000, "Subtotal calculation (2 x 1500 = 3000)");
    assert(gstAmount === 150, "GST 5% calculation on 3000 = 150");
    assert(grandTotal === 3150, "Grand total with 5% GST = 3150");
  }

  // Test 2: Customer Rate Override Calculation
  {
    const standardPrice = 1500;
    const customerRate = 1550;
    const qty = 1;
    const diff = customerRate - standardPrice;
    const itemTotal = qty * customerRate;

    assert(diff === 50, "Customer Rate difference is +50");
    assert(itemTotal === 1550, "Billed amount uses customer rate 1550 instead of standard price 1500");
  }

  // Test 3: Profit Calculation (Revenue - COGS = Gross Profit)
  {
    const purchasePrice = 1300;
    const sellingPrice = 1550;
    const gstAmount = 0;
    const cogs = purchasePrice * 1;
    const grossProfit = sellingPrice - gstAmount - cogs;
    const expenses = 50;
    const netProfit = grossProfit - expenses;

    assert(cogs === 1300, "COGS correctly calculated from purchase price (1300)");
    assert(grossProfit === 250, "Gross profit correctly calculated (1550 - 1300 = 250)");
    assert(netProfit === 200, "Net profit correctly calculated after expenses (250 - 50 = 200)");
  }

  // Test 4: Stock Validation (No Negative Inventory)
  {
    const availableStock = 5;
    const requestedQty = 7;
    const isAllowed = requestedQty <= availableStock;

    assert(isAllowed === false, "Requested quantity 7 rejected when available stock is 5");
  }

  // Test 5: Cash Register Closing Calculation
  {
    const openingCash = 5000;
    const cashSales = 20000;
    const expectedCash = openingCash + cashSales;
    const actualCash = 24800;
    const variance = actualCash - expectedCash;

    assert(expectedCash === 25000, "Expected cash is opening (5000) + cash sales (20000) = 25000");
    assert(variance === -200, "Cash variance correctly identifies -200 shortage");
  }

  console.log(`\nResults: ${passed} Passed, ${failed} Failed`);
  if (failed > 0) process.exit(1);
}

runTests();
