"""Schemas de validation Marshmallow pour les API."""

from marshmallow import Schema, fields, validate, validates_schema, ValidationError


# ── Dataset ──────────────────────────────────────────────────

class CleaningStepSchema(Schema):
    step = fields.String(required=True, validate=validate.OneOf([
        "deduplication", "missing_values", "outliers", "normalization", "encoding",
    ]))
    config = fields.Dict(load_default={})


class CleaningPipelineSchema(Schema):
    pipeline = fields.List(fields.Nested(CleaningStepSchema), required=True)


class ExcludedColumnsSchema(Schema):
    excluded_columns = fields.List(fields.String(), required=True)


class ColumnTypeSchema(Schema):
    column = fields.String(required=True)
    new_type = fields.String(required=True, validate=validate.OneOf([
        "continu", "discret", "temporel", "catégoriel_nominal", "binaire",
    ]))


# ── Analyse ──────────────────────────────────────────────────

class HypothesisTestSchema(Schema):
    test_type = fields.String(required=True, validate=validate.OneOf([
        "compare_means", "correlation", "independence",
    ]))
    group_col = fields.String(load_default=None)
    value_col = fields.String(load_default=None)
    col1 = fields.String(load_default=None)
    col2 = fields.String(load_default=None)
    method = fields.String(load_default=None)


# ── Modélisation ─────────────────────────────────────────────

class TrainModelsSchema(Schema):
    target_column = fields.String(required=True)
    models = fields.List(fields.String(), load_default=None)
    test_size = fields.Float(load_default=0.2, validate=validate.Range(min=0.05, max=0.5))
    split_strategy = fields.String(load_default="auto", validate=validate.OneOf(["auto", "random", "time"]))
    temporal_column = fields.String(load_default=None)


class PredictSchema(Schema):
    features = fields.Raw(required=True)  # dict or list of dicts


# ── Séries temporelles ────────────────────────────────────────

class TimeSeriesSchema(Schema):
    date_col = fields.String(required=True)
    value_col = fields.String(required=True)
    models = fields.List(fields.String(), load_default=None)
    forecast_steps = fields.Integer(load_default=10, validate=validate.Range(min=1, max=365))


class MultivariateTimeSeriesSchema(Schema):
    date_col = fields.String(required=True)
    value_cols = fields.List(fields.String(), required=True, validate=validate.Length(min=2))
    models = fields.List(fields.String(), load_default=None)
    forecast_steps = fields.Integer(load_default=10, validate=validate.Range(min=1, max=365))
    granger_max_lag = fields.Integer(load_default=4, validate=validate.Range(min=1, max=20))
    forced_model = fields.String(load_default=None, validate=validate.OneOf(
        ["var", "vecm", "ardl", "bvar", "pairwise_var", "varmax"]
    ))
    var_data_mode = fields.String(load_default="auto", validate=validate.OneOf(["auto", "levels", "diff"]))
    granger_data_mode = fields.String(load_default="auto", validate=validate.OneOf(["auto", "levels", "diff"]))
    var_trend = fields.String(load_default="c", validate=validate.OneOf(["c", "ct", "ctt", "n"]))
    forecast_dates = fields.List(fields.String(), load_default=None)
    target_col = fields.String(load_default=None)
    bvar_lambda1 = fields.Float(load_default=0.2, validate=validate.Range(min=0.01, max=1.0))
    bvar_lambda2 = fields.Float(load_default=0.5, validate=validate.Range(min=0.01, max=1.0))
    max_lag = fields.Integer(load_default=12, validate=validate.Range(min=1, max=60))
    ic_criterion = fields.String(load_default="aic", validate=validate.OneOf(["aic", "bic", "hqic", "fpe"]))
    irf_periods = fields.Integer(load_default=20, validate=validate.Range(min=1, max=100))
    fevd_periods = fields.Integer(load_default=20, validate=validate.Range(min=1, max=100))
    confidence_level = fields.Float(load_default=0.95, validate=validate.Range(min=0.5, max=0.99))
    bootstrap_irf = fields.Boolean(load_default=False)
    irf_orth = fields.Boolean(load_default=True)
    vecm_det_order = fields.Integer(load_default=0, validate=validate.Range(min=-1, max=1))
    max_diff_order = fields.Integer(load_default=2, validate=validate.Range(min=0, max=3))


# ── Transformations ──────────────────────────────────────────

class TransformItemSchema(Schema):
    column = fields.String(required=True)
    transform = fields.String(required=True)
    params = fields.Dict(load_default={})


class TransformPreviewSchema(Schema):
    column = fields.String(required=True)
    transform = fields.String(required=True)
    params = fields.Dict(load_default={})


class TransformApplySchema(Schema):
    transforms = fields.List(fields.Nested(TransformItemSchema), required=True, validate=validate.Length(min=1))
    inplace = fields.Boolean(load_default=False)


# ── Analyse factorielle ─────────────────────────────────────

class PCASchema(Schema):
    columns = fields.List(fields.String(), load_default=None)
    n_components = fields.Integer(load_default=None, validate=validate.Range(min=1, max=50))


class CASchema(Schema):
    row_col = fields.String(required=True)
    col_col = fields.String(required=True)
    n_components = fields.Integer(load_default=None, validate=validate.Range(min=1, max=50))


class MCASchema(Schema):
    columns = fields.List(fields.String(), load_default=None)
    n_components = fields.Integer(load_default=None, validate=validate.Range(min=1, max=50))


# ── Rapport ──────────────────────────────────────────────────

class ReportSchema(Schema):
    title = fields.String(load_default="Rapport d'Analyse")
    organization = fields.String(load_default="OpenStats — Elmas Labs")


# ── Graphiques ───────────────────────────────────────────────

class ChartDataSchema(Schema):
    chart_type = fields.String(required=True)
    x = fields.String(load_default=None)
    y = fields.String(load_default=None)
    group_by = fields.String(load_default=None)
    agg = fields.String(load_default="mean")


class ComputeVariableSchema(Schema):
    new_column = fields.String(required=True)
    formula = fields.String(required=True)


# ── Utilitaire ───────────────────────────────────────────────

def validate_payload(schema_class, data):
    """Valide un payload et retourne (data, None) ou (None, error_response)."""
    schema = schema_class()
    try:
        validated = schema.load(data or {})
        return validated, None
    except ValidationError as err:
        return None, {
            "error": "Validation échouée",
            "details": err.messages,
        }
