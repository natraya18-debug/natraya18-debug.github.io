# Human body model — attribution

`intrarat-body.web.glb` and `intrarat-body.mobile.glb` are adapted from:

**BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International.**

- Licence page: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html (updated 2025-02-27) — permits
  redistribution and derivative works of part or all of the data, with this attribution.
- Licence terms: https://creativecommons.org/licenses/by/4.0/
- Dataset: BodyParts3D 4.0 (`isa_BP3D_4.0_obj_99.zip`), adult male reference anatomy.
- Publication: Mitsuhashi N. et al. (2009) BodyParts3D: 3D structure database for anatomical concepts.
  Nucleic Acids Research 37: D782–D785. https://doi.org/10.1093/nar/gkn613
- Obtained through the packed copy in https://github.com/ashemag/human-atlas (commit 1c38bf3), whose
  `public/ATTRIBUTION.md` records the conversion from the original OBJ files (millimetres/Z-up → metres/Y-up,
  meshoptimizer simplification at 0.2 % error). Only that data was used; no code from that repository.

**Changes made here** (`scripts/build-body-model.mjs`): 2,110 of the 2,234 source meshes were grouped into
37 structures by BodyParts3D's own concepts and names (none modelled or added); each structure merged into one
mesh, simplified to a triangle budget (desktop ≈ 300,000 triangles in total, phone ≈ 120,000), smooth
normals left to the browser, quantized and compressed (EXT_meshopt_compression). 124 source meshes are not shown (reproductive
organs, ligaments and some small structures); see `content/body-model.json`.

**Detail packs** (`detail/*.glb`, `scripts/build-body-model.mjs --detail`): the same 2,109 source meshes (all shown
meshes except the skin), each kept as its own selectable part, simplified per part and grouped into five packs that
the viewer downloads only on request. `content/body-detail.json` lists each part's BodyParts3D id, English FMA name and
FMA concept id, as given in the BodyParts3D 4.0 tables.

**Eye** (`eye/eye-right.glb`, `scripts/build-body-model.mjs --eye`, page `/anatomy/eye`): BodyParts3D, © The
Database Center for Life Science licensed under CC Attribution 4.0 International. The 12 source meshes of the right
eyeball and its optic nerve at full resolution (not simplified), one node per structure. Changes: 14 tiny loose fragments
removed (each under 16 triangles and 0.01 mm²; three lay at the left eye), one of the two right optic-nerve meshes
(FJ1819) left out because it runs 12.5 mm into the vitreous body, the optic nerve shortened to 12 mm behind the eyeball,
quantized and compressed. Added, and marked as illustrations in `content/eye-model.json` and on the page: three cataract
locations made from the lens's own shape, and an intraocular lens drawn from published dimensions (6.0 mm optic).
`eye/eye-right-poster.webp` is a still rendered from the same model.

The model shows one adult male reference body. It is not a model of any patient and is not a clinical tool.

**Knee** (`knee/knee-right.glb`, `scripts/build-knee-model.mjs`, page `/anatomy/knee`): BodyParts3D, © The Database
Center for Life Science licensed under CC Attribution 4.0 International. Built from the **original** BodyParts3D 4.0 OBJ
files (`isa_BP3D_4.0_obj_99.zip`, sha256 `40665852…cd409e`, from dbarchive.biosciencedbc.jp), not the packed copy above:
right femur, tibia, fibula, patella (FJ3365, FJ3387, FJ3366, FJ3381), rectus femoris and the three vasti, biceps femoris
(both heads), semitendinosus, semimembranosus, both heads of gastrocnemius, popliteal artery and vein. Changes: cut to a
band 115 mm above and 105 mm below the joint line with the cut faces closed; bones smoothed for display with one step of
Loop subdivision (surface moved by at most 0.7 mm); quantized and compressed. Added, and marked as illustrations in
`content/knee-model.json` and on the page, because BodyParts3D 4.0 has none of them: articular cartilage, the medial and
lateral menisci, and the ACL, PCL, MCL and LCL, placed on the real bones. Note: the OBJ file headers still carry the
dataset's older notice (CC BY-SA 2.1 Japan); the licence page (updated 2025-02-27) states CC BY 4.0 — listed for legal
confirmation. `knee/knee-right-poster.webp` is a still rendered from the same model.
