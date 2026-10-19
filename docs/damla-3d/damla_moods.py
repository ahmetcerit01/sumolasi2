"""Damla maskotunu uygulamadaki 5 ruh haliyle üretir ve şeffaf PNG olarak çizer.

Çalıştırma:
  blender --background --python docs/damla-3d/damla_moods.py

Çıktı:
  docs/damla-3d/renders/damla_<mood>.png   (1024 px, thirsty/normal/happy/celebrate/sleepy)
  Uygulama ve widget 384 px kopyaları kullanır:
    for m in thirsty normal happy celebrate sleepy; do
      sips -Z 384 docs/damla-3d/renders/damla_$m.png --out assets/mascot/damla_$m.png; done
  docs/damla-3d/damla.glb          (normal hali, düzenleme/3B kullanım için)

Karakter geometrisi create_damla.py ile aynıdır; yalnızca yüz, kollar ve küçük aksesuarlar
ruh haline göre değişir. Uygulamadaki moodFor() ve widget'taki moodNow() aynı adları kullanır.
"""
import bpy, math, os
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT_PNG = os.path.join(HERE, 'renders')  # ham 1024 px; uygulamaya 384 px kopyaları konur (aşağıdaki not)
os.makedirs(OUT_PNG, exist_ok=True)
SIZE = 1024
MOODS = ['thirsty', 'normal', 'happy', 'celebrate', 'sleepy']


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def mat(name, color, rough=.28, metal=0.0, transmission=0.0, emission=0.0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    if p:
        p.inputs['Base Color'].default_value = (*color, 1)
        p.inputs['Roughness'].default_value = rough
        p.inputs['Metallic'].default_value = metal
        for key in ('Transmission Weight', 'Transmission'):
            if key in p.inputs:
                p.inputs[key].default_value = transmission
                break
        if emission and 'Emission Color' in p.inputs:
            p.inputs['Emission Color'].default_value = (*color, 1)
            p.inputs['Emission Strength'].default_value = emission
    return m


def build(mood):
    M = {
        'aqua': mat('Damla | aqua', (.45, .70, .76) if mood == 'thirsty' else (.10, .72, .78), .2, 0, .18),
        'white': mat('Warm white', (.97, .99, 1), .22),
        'iris': mat('Deep teal', (.012, .12, .17), .18),
        'black': mat('Mouth and pupils', (.008, .035, .045), .22),
        'pink': mat('Cheeks', (1, .29, .36), .35),
        'tongue': mat('Tongue', (1, .42, .48), .4),
        'yellow': mat('Lemon rind', (1, .69, .08), .28),
        'lemon': mat('Lemon flesh', (1, .91, .43), .35),
        'green': mat('Leaf', (.12, .55, .24), .3),
        'sole': mat('Sneaker sole', (.96, .98, .91), .35),
        'spark': mat('Sparkle', (1, .78, .2), .3, 0, 0, 2.0),
        'sweat': mat('Sweat bead', (.62, .9, .98), .1, 0, .3),
    }

    def droplet_mesh():
        rings, seg = 40, 64
        verts, faces = [], []
        for j in range(rings + 1):
            t = j / rings
            z = -1.05 + 2.15 * t
            # create_damla.py ile aynı karın; tepe daha çok incelir ki siluet damla gibi okunsun
            radius = 0.88 * (math.sin(math.pi * (t * .88 + .04)) ** .68) * (1 - .62 * t ** 2.4)
            radius = max(.018, radius)
            for i in range(seg):
                a = 2 * math.pi * i / seg
                verts.append((radius * math.cos(a), radius * math.sin(a), z))
        for j in range(rings):
            for i in range(seg):
                a = j * seg + i
                b = j * seg + (i + 1) % seg
                faces.append((a, b, b + seg, a + seg))
        faces.append(tuple(range(seg - 1, -1, -1)))
        faces.append(tuple(rings * seg + i for i in range(seg)))
        mesh = bpy.data.meshes.new('Tapered droplet mesh')
        mesh.from_pydata(verts, [], faces)
        mesh.update()
        ob = bpy.data.objects.new('Damla | body', mesh)
        bpy.context.collection.objects.link(ob)
        ob.data.materials.append(M['aqua'])
        for p in mesh.polygons:
            p.use_smooth = True
        ob.modifiers.new('Silky smooth', 'SUBSURF').levels = 2
        return ob

    def uv(name, loc, scale, material, seg=32):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=20, location=loc)
        o = bpy.context.object
        o.name = name
        o.scale = scale
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        for p in o.data.polygons:
            p.use_smooth = True
        o.data.materials.append(material)
        return o

    def curve(name, pts, bevel, material):
        c = bpy.data.curves.new(name, 'CURVE')
        c.dimensions = '3D'
        c.bevel_depth = bevel
        c.bevel_resolution = 4
        s = c.splines.new('BEZIER')
        s.bezier_points.add(len(pts) - 1)
        for bp, co in zip(s.bezier_points, pts):
            bp.co = co
            bp.handle_left_type = 'AUTO'
            bp.handle_right_type = 'AUTO'
        o = bpy.data.objects.new(name, c)
        bpy.context.collection.objects.link(o)
        o.data.materials.append(material)
        return o

    def star(name, loc, size):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, location=loc)
        o = bpy.context.object
        o.name = name
        o.scale = (size, size * .45, size)
        o.rotation_euler = (0, math.radians(45), 0)
        o.data.materials.append(M['spark'])
        return o

    droplet_mesh()

    # --- gözler ---
    look_up = .05 if mood == 'thirsty' else 0
    for side, x in [('L', -.30), ('R', .30)]:
        if mood in ('happy',):
            # kapalı, mutlu gözler: ters U
            curve('Happy eye ' + side, [(x - .14, -.86, .25), (x, -.90, .37), (x + .14, -.86, .25)], .034, M['black'])
        elif mood == 'sleepy':
            # uykulu: aşağı kıvrık kapalı gözler
            curve('Sleepy eye ' + side, [(x - .15, -.86, .33), (x, -.90, .25), (x + .15, -.86, .33)], .03, M['black'])
        else:
            big = 1.12 if mood == 'celebrate' else 1.0
            uv('Eye white ' + side, (x, -.77, .31), (.205 * big, .105, .255 * big), M['white'])
            uv('Iris ' + side, (x + .025, -.866, .29 + look_up), (.119 * big, .055, .158 * big), M['iris'])
            uv('Pupil ' + side, (x + .035, -.911, .29 + look_up), (.066 * big, .036, .099 * big), M['black'])
            uv('Eye sparkle ' + side, (x - .005, -.941, .36 + look_up), (.035 * big, .021, .044 * big), M['white'], 20)
            if mood == 'celebrate':
                uv('Eye sparkle 2 ' + side, (x + .06, -.945, .24), (.02, .015, .025), M['white'], 16)

    # --- kaşlar (susuz: endişeli) ---
    if mood == 'thirsty':
        curve('Brow L', [(-.46, -.82, .58), (-.30, -.86, .61), (-.17, -.86, .66)], .022, M['black'])
        curve('Brow R', [(.46, -.82, .58), (.30, -.86, .61), (.17, -.86, .66)], .022, M['black'])

    # --- yanaklar ---
    cheek = (.19, .045, .095) if mood in ('happy', 'celebrate') else (.17, .045, .085)
    if mood != 'thirsty':
        uv('Cheek L', (-.54, -.72, -.12), cheek, M['pink'])
        uv('Cheek R', (.54, -.72, -.12), cheek, M['pink'])

    # --- ağız ---
    if mood == 'normal':
        curve('Smile', [(-.17, -.85, -.15), (0, -.91, -.24), (.17, -.85, -.15)], .033, M['black'])
    elif mood == 'happy':
        curve('Big smile', [(-.24, -.84, -.12), (0, -.92, -.30), (.24, -.84, -.12)], .038, M['black'])
    elif mood == 'celebrate':
        uv('Open mouth', (0, -.86, -.20), (.18, .06, .13), M['black'])
        uv('Tongue', (0, -.905, -.27), (.10, .03, .05), M['tongue'])
    elif mood == 'thirsty':
        uv('Small mouth', (0, -.89, -.20), (.07, .04, .06), M['black'])
    elif mood == 'sleepy':
        uv('Yawn', (0, -.89, -.20), (.075, .04, .095), M['black'])

    # --- yaprak ---
    leaf = uv('Leaf', (0, 0, 1.12), (.30, .075, .13), M['green'])
    leaf.rotation_euler[1] = -.55 if mood == 'thirsty' else -.28  # susuzken yaprak sarkık
    curve('Leaf vein', [(-.22, -.074, 1.08), (0, -.09, 1.13), (.23, -.06, 1.17)], .012, M['sole'])

    # --- kollar ---
    for s, x in [('L', -.78), ('R', .78)]:
        if mood == 'celebrate':
            # kollar dışarı-yukarı açılır, eldiven kolun ucunda
            out = -1 if x < 0 else 1
            ry = .62 * out
            cx, cz = x * .98, .16
            arm = uv('Arm ' + s, (cx, -.03, cz), (.11, .12, .34), M['aqua'])
            arm.rotation_euler[1] = ry
            uv('Mitten ' + s, (cx + math.sin(ry) * .40, -.08, cz + math.cos(ry) * .40), (.14, .13, .14), M['white'])
        else:
            arm = uv('Arm ' + s, (x, -.03, -.16), (.11, .12, .34), M['aqua'])
            arm.rotation_euler[1] = -.42 if x < 0 else .42
            uv('Mitten ' + s, (x * 1.12, -.08, -.43), (.14, .13, .14), M['white'])

    # --- bacaklar ve ayakkabılar ---
    for s, x in [('L', -.34), ('R', .34)]:
        uv('Leg ' + s, (x, 0, -1.12), (.095, .11, .23), M['aqua'])
        uv('Sneaker ' + s, (x, -.07, -1.32), (.23, .32, .14), M['yellow'])
        uv('Sneaker sole ' + s, (x, -.08, -1.40), (.24, .32, .055), M['sole'])

    # --- limon (kutlamada havada değil, kolu yukarıda olduğu için gizli) ---
    if mood != 'celebrate':
        lemon = uv('Lemon wedge | rind', (.88, -.18, -.06), (.27, .13, .24), M['yellow'])
        lemon.rotation_euler[1] = -.35
        uv('Lemon wedge | juicy center', (.88, -.295, -.06), (.205, .035, .17), M['lemon'])
        for i in range(3):
            x = .80 + i * .08
            uv('Lemon segment %02d' % i, (x, -.333, -.06 + (.06 if i == 1 else -.015)), (.018, .012, .085), M['white'], 16)

    # --- ruh haline özel süsler ---
    if mood == 'celebrate':
        for i, (x, z, sz) in enumerate([(-1.15, .95, .11), (1.15, 1.05, .09), (-1.25, .1, .07), (1.28, .25, .08), (0.0, 1.55, .07)]):
            star('Sparkle %d' % i, (x, -.2, z), sz)
    elif mood == 'thirsty':
        uv('Sweat bead', (.66, -.62, .62), (.065, .045, .1), M['sweat'], 24)
    elif mood == 'sleepy':
        for i, (x, z, sz) in enumerate([(.72, 1.05, .32), (1.02, 1.38, .22)]):
            bpy.ops.object.text_add(location=(x, -.3, z), rotation=(math.radians(90), 0, 0))
            t = bpy.context.object
            t.data.body = 'z'
            t.data.size = sz
            t.data.extrude = .03
            t.data.align_x = 'CENTER'
            t.data.materials.append(M['iris'])
    if mood in ('normal', 'happy'):
        for i, (x, z, sc) in enumerate([(-1.05, .56, .07), (1.13, .56, .055), (-1.04, -.55, .05)]):
            uv('Splash bead %d' % i, (x, -.1, z), (sc, sc, sc * 1.4), M['aqua'], 20)


def stage():
    scene = bpy.context.scene
    world = bpy.data.worlds.new('Studio')
    scene.world = world
    world.color = (.8, .8, .8)
    bpy.ops.object.camera_add(location=(0, -7.5, .05))
    cam = bpy.context.object
    cam.rotation_euler = (math.radians(90), 0, 0)
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = 3.7
    scene.camera = cam
    for name, loc, power, size in [('Key', (-3, -4, 4), 520, 4), ('Fill', (3, -2, 1.5), 320, 3), ('Rim', (0, 2, 3), 480, 3)]:
        bpy.ops.object.light_add(type='AREA', location=loc)
        l = bpy.context.object
        l.name = 'Light | ' + name
        l.data.energy = power
        l.data.shape = 'DISK'
        l.data.size = size
        l.rotation_euler = (Vector((0, 0, 0)) - l.location).to_track_quat('-Z', 'Y').to_euler()
    for engine in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE', 'CYCLES'):
        try:
            scene.render.engine = engine
            break
        except TypeError:
            continue
    if scene.render.engine == 'CYCLES':
        scene.cycles.samples = 64
    scene.render.resolution_x = SIZE
    scene.render.resolution_y = SIZE
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.view_settings.view_transform = 'AgX'


for mood in MOODS:
    reset()
    build(mood)
    stage()
    bpy.context.scene.render.filepath = os.path.join(OUT_PNG, 'damla_%s.png' % mood)
    bpy.ops.render.render(write_still=True)
    print('rendered', mood)
    if mood == 'normal':
        for o in bpy.context.scene.objects:
            o.select_set(o.type in {'MESH', 'CURVE', 'FONT'})
        bpy.ops.export_scene.gltf(filepath=os.path.join(HERE, 'damla.glb'), export_format='GLB', use_selection=True, export_apply=True)
