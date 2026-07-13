-- =====================================================================================
-- WINARY AI — Database RPC Functions
-- Run this script in your Supabase SQL Editor to install the atomic functions.
-- These functions prevent financial race conditions (e.g., double-spending, double-claiming).
-- =====================================================================================

-- 1. Atomically increment or decrement user balance
-- Usage: SELECT increment_balance('user-uuid', 500);
CREATE OR REPLACE FUNCTION increment_balance(user_id UUID, amount_cents INT)
RETURNS INT AS $$
DECLARE
  new_balance INT;
BEGIN
  UPDATE users
  SET balance_cents = balance_cents + amount_cents
  WHERE id = user_id
  RETURNING balance_cents INTO new_balance;

  RETURN new_balance;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;


-- 2. Atomically claim work earnings
-- Prevents double-claiming by locking the purchase row and verifying next_allowed_at.
CREATE OR REPLACE FUNCTION claim_work(p_user_id UUID, p_purchase_id UUID, p_earned_cents INT)
RETURNS TABLE(earned_cents INT, new_balance_cents INT) AS $$
DECLARE
  v_purchase RECORD;
  v_new_balance INT;
BEGIN
  -- Lock the purchase row to prevent concurrent claims
  SELECT * INTO v_purchase
  FROM purchases
  WHERE id = p_purchase_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Achat introuvable';
  END IF;

  -- Verify it can be claimed
  IF v_purchase.next_allowed_at IS NULL OR v_purchase.next_allowed_at > NOW() THEN
    RAISE EXCEPTION 'Le travail n''est pas encore terminé.';
  END IF;

  -- Update the purchase
  UPDATE purchases
  SET last_worked_at = NULL,
      next_allowed_at = NULL,
      total_earned_cents = total_earned_cents + p_earned_cents,
      work_count = work_count + 1
  WHERE id = p_purchase_id;

  -- Update the user balance
  UPDATE users
  SET balance_cents = balance_cents + p_earned_cents
  WHERE id = p_user_id
  RETURNING balance_cents INTO v_new_balance;

  -- Record the transaction
  INSERT INTO transactions (user_id, type, status, amount_cents, description)
  VALUES (p_user_id, 'WORK_EARNING', 'COMPLETED', p_earned_cents, 'Gains ' || v_purchase.bot_name);

  RETURN QUERY SELECT p_earned_cents, v_new_balance;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;


-- 3. Atomically purchase a bot with account balance
-- Checks balance, deducts it, and creates purchase/transaction in one atomic operation.
CREATE OR REPLACE FUNCTION purchase_bot_with_balance(
  p_user_id UUID,
  p_bot_id TEXT,
  p_bot_name TEXT,
  p_price_cents INT,
  p_expires_at TIMESTAMPTZ,
  p_sponsor_id UUID,
  p_commission_cents INT
)
RETURNS TABLE(purchase_id UUID, new_balance_cents INT) AS $$
DECLARE
  v_user_balance INT;
  v_purchase_id UUID;
BEGIN
  -- Lock user to check balance
  SELECT balance_cents INTO v_user_balance
  FROM users
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_user_balance < p_price_cents THEN
    RAISE EXCEPTION 'Solde insuffisant pour cet achat';
  END IF;

  -- Deduct balance
  UPDATE users
  SET balance_cents = balance_cents - p_price_cents
  WHERE id = p_user_id
  RETURNING balance_cents INTO v_user_balance;

  -- Create Purchase
  INSERT INTO purchases (user_id, bot_id, bot_name, price_paid_cents, expires_at, status, operator, tx_reference)
  VALUES (p_user_id, p_bot_id, p_bot_name, p_price_cents, p_expires_at, 'ACTIVE', 'BALANCE', 'Achat via Solde')
  RETURNING id INTO v_purchase_id;

  -- Create Transaction
  INSERT INTO transactions (user_id, type, status, amount_cents, description, operator, tx_reference)
  VALUES (p_user_id, 'BOT_PURCHASE', 'COMPLETED', -p_price_cents, 'Achat ' || p_bot_name || ' (Solde)', 'BALANCE', 'Solde');

  -- Handle Sponsor Commission
  IF p_sponsor_id IS NOT NULL AND p_commission_cents > 0 THEN
    UPDATE users
    SET balance_cents = balance_cents + p_commission_cents
    WHERE id = p_sponsor_id;

    INSERT INTO transactions (user_id, type, status, amount_cents, description)
    VALUES (p_sponsor_id, 'REFERRAL_BONUS', 'COMPLETED', p_commission_cents, 'Commission parrainage');
  END IF;

  RETURN QUERY SELECT v_purchase_id, v_user_balance;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;
