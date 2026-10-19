"""Generate a stylized, editable Damla mascot in Blender.
Run: blender --background --python create_damla.py
Creates damla.blend and damla.glb beside this script.
"""
import bpy, math, os
from mathutils import Vector

OUT = os.path.dirname(os.path.abspath(__file__))
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials):
    pass

def mat(name, color, rough=.28, metal=0.0, transmission=0.0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    p=m.node_tree.nodes.get(' Principled BSDF') or m.node_tree.nodes.get('Principled BSDF')
    if p:
        p.inputs['Base Color'].default_value=(*color,1); p.inputs['Roughness'].default_value=rough
        p.inputs['Metallic'].default_value=metal
        if 'Transmission' in p.inputs: p.inputs['Transmission'].default_value=transmission
    return m
AQUA=mat('Damla | translucent aqua',(.10,.72,.78),.2,0,.18)
WHITE=mat('Warm white',(.97,.99,1),.22); IRIS=mat('Deep teal',(.012,.12,.17),.18)
BLACK=mat('Mouth and pupils',(.008,.035,.045),.22); PINK=mat('Cheeks', (1,.29,.36),.35)
YELLOW=mat('Lemon rind', (1,.69,.08),.28); LEMON=mat('Lemon flesh',(1,.91,.43),.35)
GREEN=mat('Leaf',(.12,.55,.24),.3); SOLE=mat('Sneaker sole',(.96,.98,.91),.35)

# Mesh-based plump teardrop: tapered crown, broad lower body.
def droplet_mesh():
    rings=40; seg=64; verts=[]; faces=[]
    for j in range(rings+1):
        t=j/rings
        z=-1.05+2.15*t
        # broad belly, narrowing smoothly to the crown
        radius=0.88*(math.sin(math.pi*(t*.88+.04))**.68)*(1-.30*t)
        radius=max(.018,radius)
        for i in range(seg):
            a=2*math.pi*i/seg
            verts.append((radius*math.cos(a),radius*math.sin(a),z))
    for j in range(rings):
        for i in range(seg):
            a=j*seg+i; b=j*seg+(i+1)%seg
            faces.append((a,b,b+seg,a+seg))
    faces.append(tuple(range(seg-1,-1,-1))); faces.append(tuple(rings*seg+i for i in range(seg)))
    mesh=bpy.data.meshes.new('Tapered droplet mesh'); mesh.from_pydata(verts,[],faces); mesh.update()
    ob=bpy.data.objects.new('Damla | body',mesh); bpy.context.collection.objects.link(ob); ob.data.materials.append(AQUA)
    for p in mesh.polygons:p.use_smooth=True
    sub=ob.modifiers.new('Silky smooth','SUBSURF'); sub.levels=2
    return ob

def uv(name, loc, scale, material, seg=32):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=20, location=loc)
    o=bpy.context.object; o.name=name; o.scale=scale; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    for p in o.data.polygons:p.use_smooth=True
    o.data.materials.append(material); return o

def curve(name, pts, bevel, material):
    c=bpy.data.curves.new(name,'CURVE'); c.dimensions='3D'; c.bevel_depth=bevel; c.bevel_resolution=4
    s=c.splines.new('BEZIER'); s.bezier_points.add(len(pts)-1)
    for bp,co in zip(s.bezier_points,pts): bp.co=co; bp.handle_left_type='AUTO'; bp.handle_right_type='AUTO'
    o=bpy.data.objects.new(name,c); bpy.context.collection.objects.link(o); o.data.materials.append(material); return o

droplet_mesh()
# Face on the forward (+Y) side. Eyes and highlights use layered spheres.
for side,x in [('L',-.30),('R',.30)]:
    uv('Eye white '+side,(x,-.77,.31),(.205,.105,.255),WHITE)
    uv('Iris '+side,(x+.025,-.866,.29),(.119,.055,.158),IRIS)
    uv('Pupil '+side,(x+.035,-.911,.29),(.066,.036,.099),BLACK)
    uv('Eye sparkle '+side,(x-.005,-.941,.36),(.035,.021,.044),WHITE,20)
uv('Cheek L',(-.54,-.72,-.12),(.17,.045,.085),PINK)
uv('Cheek R',(.54,-.72,-.12),(.17,.045,.085),PINK)
curve('Happy smile',[(-.20,-.84,-.15),(0,-.91,-.26),(.20,-.84,-.15)],.035,BLACK)
# Leaf atop the droplet: flattened ellipsoid and central vein.
leaf=uv('Leaf',(0,0,1.12),(.30,.075,.13),GREEN); leaf.rotation_euler[1]=-.28
curve('Leaf vein',[(-.22,-.074,1.08),(0,-.09,1.13),(.23,-.06,1.17)],.012,SOLE)
# Tiny arms, hands, legs, simple trainers.
for s,x in [('L',-.78),('R',.78)]:
    arm=uv('Arm '+s,(x,-.03,-.16),(.11,.12,.34),AQUA); arm.rotation_euler[1]=-.42 if x<0 else .42
    uv('Mitten '+s,(x*1.12,-.08,-.43),(.14,.13,.14),WHITE)
for s,x in [('L',-.34),('R',.34)]:
    uv('Leg '+s,(x,0,-1.12),(.095,.11,.23),AQUA)
    uv('Sneaker '+s,(x,-.07,-1.32),(.23,.32,.14),YELLOW)
    uv('Sneaker sole '+s,(x,-.08,-1.40),(.24,.32,.055),SOLE)
# Lemon wedge prop, held at character's right side.
lemon=uv('Lemon wedge | rind',(.88,-.18,-.06),(.27,.13,.24),YELLOW); lemon.rotation_euler[1]=-.35
uv('Lemon wedge | juicy center',(.88,-.295,-.06),(.205,.035,.17),LEMON)
for i in range(3):
    x=.80+i*.08
    uv('Lemon segment %02d'%i,(x,-.333,-.06+(.06 if i==1 else -.015)),(.018,.012,.085),WHITE,16)
# Camera-facing accent droplets.
for i,(x,z,sc) in enumerate([(-1.05,.56,.07),(1.13,.56,.055),(-1.04,-.55,.05)]):
    uv('Splash bead %d'%i,(x,-.1,z),(sc,sc,sc*1.4),AQUA,20)

# Studio camera and soft lighting.
world=bpy.context.scene.world or bpy.data.worlds.new('Cream studio'); bpy.context.scene.world=world
world.color=(.8,.8,.8)
bpy.ops.object.camera_add(location=(0,-7.5,.05)); cam=bpy.context.object; cam.name='Camera | front portrait'
cam.rotation_euler=(math.radians(90),0,0); cam.data.type='ORTHO'; cam.data.ortho_scale=3.55; bpy.context.scene.camera=cam
for name,loc,power,size in [('Key',(-3,-4,4),520,4),('Fill',(3,-2,1.5),320,3),('Rim',(0,2,3),480,3)]:
    bpy.ops.object.light_add(type='AREA',location=loc); l=bpy.context.object; l.name='Light | '+name; l.data.energy=power; l.data.shape='DISK'; l.data.size=size
    l.rotation_euler=(Vector((0,0,0))-l.location).to_track_quat('-Z','Y').to_euler()
scene=bpy.context.scene; scene.render.engine='BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in [e.identifier for e in scene.render.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'; scene.render.resolution_x=900; scene.render.resolution_y=900; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'; scene.render.film_transparent=False
scene.view_settings.view_transform='AgX'
# Save editable scene and export selected character mesh parts as glTF.
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'damla.blend'))
# Exclude camera/lights from the model export.
for o in bpy.context.scene.objects:o.select_set(o.type in {'MESH','CURVE'})
bpy.context.view_layer.objects.active=bpy.data.objects.get('Damla | body')
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'damla.glb'),export_format='GLB',use_selection=True,export_apply=True)
