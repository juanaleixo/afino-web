-- Function to incrementally refresh portfolio_value_daily and portfolio_value_monthly
CREATE OR REPLACE FUNCTION refresh_portfolio_mvs_incremental()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_user_id uuid;
    v_date date;
    v_month date;
    r_daily RECORD;
    r_monthly RECORD;
BEGIN
    -- Determine the user_id and date affected by the trigger operation
    IF TG_OP = 'DELETE' THEN
        v_user_id := OLD.user_id;
        v_date := OLD.date;
    ELSE -- INSERT or UPDATE
        v_user_id := NEW.user_id;
        v_date := NEW.date;
    END IF;

    -- Calculate the corresponding month for monthly aggregation
    v_month := date_trunc('month', v_date)::date;

    -- Step 1: Recalculate and update portfolio_value_daily
    -- Select the aggregated values for the specific user_id and date from daily_positions_acct
    SELECT
        dpa.user_id,
        dpa.date,
        SUM(dpa.quantity * gpd.price) AS total_value,
        SUM(dpa.cost_basis) AS total_cost_basis,
        SUM(dpa.quantity * gpd.price) - SUM(dpa.cost_basis) AS profit_loss,
        (SUM(dpa.quantity * gpd.price) - SUM(dpa.cost_basis)) / NULLIF(SUM(dpa.cost_basis), 0) * 100 AS profit_loss_pct
    INTO r_daily
    FROM
        daily_positions_acct dpa
    JOIN
        global_price_daily gpd ON dpa.asset_id = gpd.asset_id AND dpa.date = gpd.date
    WHERE
        dpa.user_id = v_user_id AND dpa.date = v_date
    GROUP BY
        dpa.user_id,
        dpa.date;

    -- Update or delete the corresponding row in portfolio_value_daily
    IF r_daily.user_id IS NULL THEN
        -- If no positions exist for this user_id and date, delete the entry from the MV
        DELETE FROM portfolio_value_daily
        WHERE user_id = v_user_id AND date = v_date;
    ELSE
        -- Otherwise, insert or update the entry using ON CONFLICT DO UPDATE
        INSERT INTO portfolio_value_daily (user_id, date, total_value, total_cost_basis, profit_loss, profit_loss_pct)
        VALUES (r_daily.user_id, r_daily.date, r_daily.total_value, r_daily.total_cost_basis, r_daily.profit_loss, r_daily.profit_loss_pct)
        ON CONFLICT (user_id, date) DO UPDATE SET
            total_value = EXCLUDED.total_value,
            total_cost_basis = EXCLUDED.total_cost_basis,
            profit_loss = EXCLUDED.profit_loss,
            profit_loss_pct = EXCLUDED.profit_loss_pct;
    END IF;

    -- Step 2: Recalculate and update portfolio_value_monthly
    -- Select the aggregated values for the specific user_id and month from portfolio_value_daily
    SELECT
        pvd.user_id,
        date_trunc('month', pvd.date)::date AS month,
        SUM(pvd.total_value) AS total_value,
        SUM(pvd.total_cost_basis) AS total_cost_basis,
        SUM(pvd.profit_loss) AS profit_loss
    INTO r_monthly
    FROM
        portfolio_value_daily pvd
    WHERE
        pvd.user_id = v_user_id AND date_trunc('month', pvd.date)::date = v_month
    GROUP BY
        pvd.user_id,
        date_trunc('month', pvd.date);

    -- Update or delete the corresponding row in portfolio_value_monthly
    IF r_monthly.user_id IS NULL THEN
        -- If no daily values exist for this user_id and month, delete the entry from the MV
        DELETE FROM portfolio_value_monthly
        WHERE user_id = v_user_id AND month = v_month;
    ELSE
        -- Otherwise, insert or update the entry using ON CONFLICT DO UPDATE
        INSERT INTO portfolio_value_monthly (user_id, month, total_value, total_cost_basis, profit_loss)
        VALUES (r_monthly.user_id, r_monthly.month, r_monthly.total_value, r_monthly.total_cost_basis, r_monthly.profit_loss)
        ON CONFLICT (user_id, month) DO UPDATE SET
            total_value = EXCLUDED.total_value,
            total_cost_basis = EXCLUDED.total_cost_basis,
            profit_loss = EXCLUDED.profit_loss;
    END IF;

    RETURN NULL; -- Trigger functions must return NULL for AFTER triggers
END;
$$;