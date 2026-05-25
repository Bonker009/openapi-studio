package io.github.apispector.scanner;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.github.victools.jsonschema.generator.Option;
import com.github.victools.jsonschema.generator.OptionPreset;
import com.github.victools.jsonschema.generator.SchemaGenerator;
import com.github.victools.jsonschema.generator.SchemaGeneratorConfig;
import com.github.victools.jsonschema.generator.SchemaGeneratorConfigBuilder;
import com.github.victools.jsonschema.generator.SchemaVersion;
import com.github.victools.jsonschema.module.jackson.JacksonModule;
import com.github.victools.jsonschema.module.jackson.JacksonOption;
import com.github.victools.jsonschema.module.jakarta.validation.JakartaValidationModule;
import com.github.victools.jsonschema.module.jakarta.validation.JakartaValidationOption;
import java.lang.reflect.Type;
import java.util.HashMap;
import java.util.Map;

public class SchemaResolver {

    private final SchemaGenerator generator;
    private final ObjectMapper mapper;
    private final Map<String, ObjectNode> components = new HashMap<>();

    public SchemaResolver(ObjectMapper mapper) {
        this.mapper = mapper;
        SchemaGeneratorConfig config = new SchemaGeneratorConfigBuilder(
            mapper,
            SchemaVersion.DRAFT_2020_12,
            OptionPreset.PLAIN_JSON
        )
            .with(new JacksonModule(
                JacksonOption.RESPECT_JSONPROPERTY_REQUIRED,
                JacksonOption.IGNORE_TYPE_INFO_TRANSFORM
            ))
            .with(new JakartaValidationModule(
                JakartaValidationOption.NOT_NULLABLE_FIELD_IS_REQUIRED,
                JakartaValidationOption.INCLUDE_PATTERN_EXPRESSIONS
            ))
            .with(Option.PUBLIC_NONSTATIC_FIELDS)
            .with(Option.NONPUBLIC_NONSTATIC_FIELDS_WITHOUT_GETTERS)
            .build();
        this.generator = new SchemaGenerator(config);
    }

    public ObjectNode resolve(Type type) {
        if (type == null || type == Void.TYPE || type == Void.class) {
            return null;
        }
        String key = sanitize(type.getTypeName());
        if (components.containsKey(key)) {
            ObjectNode ref = mapper.createObjectNode();
            ref.put("$ref", "#/components/schemas/" + key);
            return ref;
        }
        JsonNode raw = generator.generateSchema(type);
        if (raw == null || raw.isNull()) {
            return null;
        }
        ObjectNode schema = raw.isObject() ? (ObjectNode) raw.deepCopy() : mapper.createObjectNode();
        components.put(key, schema);
        ObjectNode ref = mapper.createObjectNode();
        ref.put("$ref", "#/components/schemas/" + key);
        return ref;
    }

    public ObjectNode componentsSchemas() {
        ObjectNode schemas = mapper.createObjectNode();
        components.forEach((k, v) -> schemas.set(sanitize(k), v));
        return schemas;
    }

    private static String sanitize(String typeName) {
        return typeName.replace('.', '_').replace('$', '_');
    }
}
