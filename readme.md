  "serve-static": "vite --host 172.48.0.115 --port 5173"
     "serve-static": "serve -s dist -l tcp://172.48.0.115:5173"
     git pull origin main

     git add -A && git commit -m "bug" && git push origin main




     INSERT INTO Mat (mat, mat_2x, mapping_id)
SELECT rm.mat, rm.mat, rmm.mapping_id
FROM TrolleyRMMapping rmm
JOIN RMForProd rmf       ON rmm.rmfp_id          = rmf.rmfp_id
JOIN ProdRawMat pr       ON rmm.tro_production_id = pr.prod_rm_id
JOIN RawMat rm           ON pr.mat                = rm.mat
WHERE rmm.mapping_id NOT IN (SELECT mapping_id FROM Mat WHERE mapping_id IS NOT NULL)