from source_geometry import (
    Point2,
    normalize_contours,
    signed_area,
    trace_alpha_contours,
    useful_contours,
)


def test_traces_one_opaque_block():
    mask = [
        0,0,0,0,0,
        0,1,1,1,0,
        0,1,1,1,0,
        0,1,1,1,0,
        0,0,0,0,0,
    ]
    contours = trace_alpha_contours(mask, 5, 5)
    assert len(contours) == 1
    assert len(contours[0]) >= 4
    assert abs(signed_area(contours[0])) >= 9


def test_keeps_disconnected_visible_components():
    mask = [
        1,1,0,0,0,0,
        1,1,0,1,1,0,
        0,0,0,1,1,0,
        0,0,0,1,1,0,
    ]
    contours = useful_contours(mask, 6, 4, epsilon=0)
    assert len(contours) == 2
    assert abs(signed_area(contours[0])) >= abs(signed_area(contours[1]))


def test_normalizes_scene_geometry_around_origin():
    normalized = normalize_contours(
        [[
            Point2(0, 0),
            Point2(4, 0),
            Point2(4, 2),
            Point2(0, 2),
        ]],
        4,
        2,
        target_width=2,
    )
    assert normalized[0][0] == Point2(-1, 0.5)
    assert normalized[0][2] == Point2(1, -0.5)


def test_rejects_invalid_mask_dimensions():
    try:
        trace_alpha_contours([1, 1], 2, 2)
    except ValueError as exc:
        assert "dimensions" in str(exc)
    else:
        raise AssertionError("expected invalid alpha mask to fail")
